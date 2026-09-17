import assert from "node:assert/strict";
import { test } from "node:test";
import { readerMarksFile } from "@readlet/core";
import type { HighlightMark } from "@/domain/reader-marks";
import { ReaderMarksService } from "@/services/reader-marks";
import { memoryStorage } from "./lib/storage.ts";

function mark(id: string): HighlightMark {
  const now = new Date(0).toISOString();
  return {
    id,
    type: "highlight",
    anchor: { format: "epub", cfi: `epubcfi(/6/2[${id}])` },
    text: `Selection ${id}`,
    color: "yellow",
    createdAt: now,
    updatedAt: now,
  };
}

test("marks are isolated by user and updates preserve other items", async () => {
  const library = memoryStorage();
  const service = new ReaderMarksService(library.storage);
  await service.upsert("reader", "book", mark("one"));
  await service.upsert("reader", "book", mark("two"));
  await service.upsert("guest", "book", mark("guest"));
  await service.upsert("reader", "book", { ...mark("one"), note: "A note" });

  assert.equal((await service.list("reader", "book")).length, 2);
  const updated = (await service.list("reader", "book")).find(
    (item): item is HighlightMark =>
      item.id === "one" && item.type === "highlight",
  );
  assert.equal(updated?.note, "A note");
  assert.deepEqual(
    (await service.list("guest", "book")).map((item) => item.id),
    ["guest"],
  );
  assert.equal(library.has(readerMarksFile("reader")), true);

  await service.remove("reader", "book", "one");
  assert.deepEqual(
    (await service.list("reader", "book")).map((item) => item.id),
    ["two"],
  );
});

test("parallel edits in one app instance keep distinct marks", async () => {
  const library = memoryStorage();
  const first = new ReaderMarksService(library.storage);
  const second = new ReaderMarksService(library.storage);
  await Promise.all([
    first.upsert("reader", "book", mark("one")),
    second.upsert("reader", "book", mark("two")),
  ]);
  assert.deepEqual(
    new Set((await first.list("reader", "book")).map((item) => item.id)),
    new Set(["one", "two"]),
  );
});

test("a rejected conditional write reloads and preserves another device's mark", async () => {
  const library = memoryStorage();
  const original = library.storage.writeIf;
  assert.ok(original);
  let injected = false;
  library.storage.writeIf = async (...args) => {
    if (!injected) {
      injected = true;
      library.put(
        readerMarksFile("reader"),
        JSON.stringify({
          version: 1,
          books: { book: { remote: mark("remote") } },
        }),
      );
    }
    return original(...args);
  };
  const service = new ReaderMarksService(library.storage);
  await service.upsert("reader", "book", mark("local"));
  assert.deepEqual(
    new Set((await service.list("reader", "book")).map((item) => item.id)),
    new Set(["remote", "local"]),
  );
});

test("stored marks are validated at the storage boundary", async () => {
  const now = new Date(0).toISOString();
  const library = memoryStorage({
    [readerMarksFile("reader")]: JSON.stringify({
      version: 1,
      books: {
        book: {
          pdf: {
            id: "pdf",
            type: "highlight",
            anchor: {
              format: "pdf",
              page: 3,
              rects: [[0.1, 0.2, 0.3, 0.04]],
            },
            text: "PDF selection",
            color: "yellow",
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    }),
  });

  await assert.rejects(
    new ReaderMarksService(library.storage).list("reader", "book"),
    /invalid mark/,
  );
});

test("current multi-page PDF highlights round-trip unchanged", async () => {
  const now = new Date(0).toISOString();
  const highlight: HighlightMark = {
    id: "pdf",
    type: "highlight",
    anchor: {
      format: "pdf",
      page: 3,
      segments: [
        { page: 3, rects: [[0.1, 0.2, 0.3, 0.04]] },
        { page: 4, rects: [[0.2, 0.1, 0.4, 0.05]] },
      ],
    },
    text: "Selection across pages",
    color: "blue",
    createdAt: now,
    updatedAt: now,
  };
  const service = new ReaderMarksService(memoryStorage().storage);

  await service.upsert("reader", "book", highlight);

  const [stored] = await service.list("reader", "book");
  assert.ok(stored?.type === "highlight");
  assert.deepEqual(stored.anchor, highlight.anchor);
  assert.equal(stored.text, highlight.text);
  assert.equal(stored.color, highlight.color);
});
