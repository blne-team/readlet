import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { syncLibrary } from "@readlet/sync/bucket";

function fakeAdmin({ removed = 0 } = {}) {
  const put: { key: string; contentType: string }[] = [];
  const published: unknown[] = [];
  return {
    put,
    published,
    admin: {
      name: "a fake destination",
      async read() {
        return null;
      },
      async put(key: string, _file: string, contentType: string) {
        put.push({ key, contentType });
      },
      async publish(catalog: unknown) {
        published.push(catalog);
        return removed;
      },
      async remove() {},
    },
  };
}

async function tree(files: Record<string, string>): Promise<string> {
  const output = await mkdtemp(path.join(tmpdir(), "readlet-sync-"));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(output, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return output;
}

const LIBRARY = {
  "catalog.json":
    '{"version":2,"books":[{"id":"sync-a-book","title":"A book","authors":[],"addedAt":"2026-01-01","modifiedAt":"2026-01-01","cover":"cover.webp","formats":[{"format":"epub","file":"sync-a-book.epub","size":10}]}]}',
  "sync-a-book/metadata.json": "{}",
  "sync-a-book/cover.webp": "webp bytes",
  "sync-a-book/sync-a-book.epub": "epub bytes",
};

test("uploads book objects and publishes the catalog last", async () => {
  const output = await tree(LIBRARY);
  const { admin, put, published } = fakeAdmin({ removed: 3 });

  const result = await syncLibrary(admin, output, { log: () => {} });

  assert.deepEqual(put.map((entry) => entry.key).sort(), [
    "sync-a-book/cover.webp",
    "sync-a-book/metadata.json",
    "sync-a-book/sync-a-book.epub",
  ]);
  assert.equal(published.length, 1);
  assert.equal((published[0] as { books: unknown[] }).books.length, 1);
  assert.deepEqual(result, { uploaded: 4, removed: 3, failed: 0 });
});

test("gives each object its content type", async () => {
  const output = await tree(LIBRARY);
  const { admin, put } = fakeAdmin();

  await syncLibrary(admin, output, { log: () => {} });

  const byKey = Object.fromEntries(
    put.map((entry) => [entry.key, entry.contentType]),
  );
  assert.equal(byKey["sync-a-book/sync-a-book.epub"], "application/epub+zip");
  assert.equal(byKey["sync-a-book/cover.webp"], "image/webp");
});

test("does not publish a catalog that references a failed upload", async () => {
  const output = await tree(LIBRARY);
  const { admin, published } = fakeAdmin();
  const original = admin.put;
  admin.put = async (key: string, file: string, contentType: string) => {
    if (key.endsWith("cover.webp")) throw new Error("upload exploded");
    await original(key, file, contentType);
  };
  const log: string[] = [];

  const result = await syncLibrary(admin, output, {
    log: (message) => log.push(message),
  });

  assert.equal(result.failed, 1);
  assert.equal(result.uploaded, 2);
  assert.equal(published.length, 0);
  assert.ok(log.some((message) => message.includes("Catalog unchanged")));
});
