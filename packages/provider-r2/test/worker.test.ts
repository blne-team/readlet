import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createStorage,
  type R2BucketLike,
  type R2UsageBudget,
  type R2UsageReservation,
} from "../dist/worker.js";

function setup() {
  const reservations: R2UsageReservation[] = [];
  const calls: string[] = [];
  const budget: R2UsageBudget = {
    async reserve(usage) {
      reservations.push(usage);
    },
    async status() {
      throw new Error("not used by storage");
    },
  };
  const bucket: R2BucketLike = {
    async head() {
      calls.push("head");
      return null;
    },
    async get() {
      calls.push("get");
      return null;
    },
    async put() {
      calls.push("put");
      return {};
    },
    async list() {
      calls.push("list");
      return { objects: [], truncated: false };
    },
    async delete() {
      calls.push("delete");
    },
  };
  return { budget, bucket, calls, reservations };
}

test("reserves Class B before every billable read", async () => {
  const context = setup();
  const storage = createStorage(context.bucket, context.budget);

  await storage.head("book");
  await storage.read("book");
  await storage.readBytes("book");
  await storage.readRange("book", 0, 10);

  assert.deepEqual(context.calls, ["head", "get", "get", "get"]);
  assert.deepEqual(context.reservations, [
    { classB: 1 },
    { classB: 1 },
    { classB: 1 },
    { classB: 1 },
  ]);
});

test("reserves Class A and object bytes before writes", async () => {
  const context = setup();
  const storage = createStorage(context.bucket, context.budget);

  await storage.write("state.json", new Uint8Array(12));
  await storage.writeIf("state.json", new Uint8Array(8), null);
  await storage.putStream(
    "book.epub",
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("abc"));
        controller.close();
      },
    }),
    3,
    "application/epub+zip",
  );

  assert.deepEqual(context.calls, ["put", "put", "put"]);
  assert.deepEqual(context.reservations, [
    { classA: 1, objects: [{ key: "state.json", bytes: 12 }] },
    { classA: 1, objects: [{ key: "state.json", bytes: 8 }] },
    { classA: 1, objects: [{ key: "book.epub", bytes: 3 }] },
  ]);
});

test("passes a fixed-length stream to the Worker R2 binding", async () => {
  const context = setup();
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    "FixedLengthStream",
  );
  let fixedLength = 0;
  let fixedReadable: ReadableStream<Uint8Array> | null = null;
  class TestFixedLengthStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;

    constructor(length: number) {
      fixedLength = length;
      const stream = new TransformStream<Uint8Array, Uint8Array>();
      this.readable = stream.readable;
      this.writable = stream.writable;
      fixedReadable = this.readable;
    }
  }
  Object.defineProperty(globalThis, "FixedLengthStream", {
    configurable: true,
    value: TestFixedLengthStream,
  });
  try {
    context.bucket.put = async (_key, value) => {
      assert.equal(value, fixedReadable);
      assert.equal(await new Response(value).text(), "abc");
      return {};
    };
    await createStorage(context.bucket, context.budget).putStream(
      "book.pdf",
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("abc"));
          controller.close();
        },
      }),
      3,
      "application/pdf",
    );
    assert.equal(fixedLength, 3);
  } finally {
    if (previous)
      Object.defineProperty(globalThis, "FixedLengthStream", previous);
    else Reflect.deleteProperty(globalThis, "FixedLengthStream");
  }
});

test("never reaches R2 when the budget rejects a reservation", async () => {
  const context = setup();
  context.budget.reserve = async () => {
    throw new Error("budget exhausted");
  };
  const storage = createStorage(context.bucket, context.budget);

  await assert.rejects(storage.read("book"), /budget exhausted/);
  assert.deepEqual(context.calls, []);
});

test("does not reserve free deletes or empty range reads", async () => {
  const context = setup();
  const storage = createStorage(context.bucket, context.budget);

  await storage.remove("old-book");
  assert.equal(await storage.readRange("book", 0, 0), null);

  assert.deepEqual(context.calls, ["delete"]);
  assert.deepEqual(context.reservations, []);
});

test("erases every object in repeated batches", async () => {
  const context = setup();
  const remaining = ["catalog.json", "book.epub", "users.json"];
  context.bucket.list = async (options) => {
    assert.deepEqual(options, { limit: 1_000 });
    context.calls.push("list");
    return {
      objects: remaining.slice(0, 2).map((key) => ({
        key,
        size: 1,
        httpEtag: '"etag"',
        uploaded: new Date(0),
      })),
      truncated: remaining.length > 2,
    };
  };
  context.bucket.delete = async (keys) => {
    context.calls.push("delete");
    assert.ok(Array.isArray(keys));
    remaining.splice(0, keys.length);
  };

  await createStorage(context.bucket, context.budget).eraseAll();

  assert.deepEqual(remaining, []);
  assert.deepEqual(context.calls, ["list", "delete", "list", "delete", "list"]);
  assert.deepEqual(context.reservations, [
    { classA: 1 },
    { classA: 1 },
    { classA: 1 },
  ]);
});
