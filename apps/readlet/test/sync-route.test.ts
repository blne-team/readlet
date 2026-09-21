import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG_FILE, CATALOG_VERSION, type Catalog } from "@readlet/core";
import {
  POST as publish,
  PUT as upload,
} from "../src/app/api/library/sync/route.ts";
import { createServices, setServices } from "../src/services/container.ts";
import { startAccessFixture } from "./lib/access.ts";
import { memoryStorage, nullCache } from "./lib/storage.ts";

const at = "2026-01-01T00:00:00.000Z";
const browserBook = {
  id: "book-browser",
  addedAt: at,
  modifiedAt: at,
  title: "Browser book",
  authors: [],
  formats: [{ format: "epub", file: "browser.epub", size: 1 }],
};
const oldSyncBook = {
  id: "sync-old",
  addedAt: at,
  modifiedAt: at,
  title: "Old sync book",
  authors: [],
  formats: [{ format: "epub", file: "sync-old.epub", size: 1 }],
};
const newSyncBook = {
  id: "sync-new",
  addedAt: at,
  modifiedAt: at,
  title: "New sync book",
  authors: [],
  formats: [{ format: "epub", file: "sync-new.epub", size: 4 }],
};

test("R2 sync contributes books without replacing browser imports", async () => {
  const access = await startAccessFixture();
  const token = await access.serviceTokenFor("sync.access");
  const headers = { "cf-access-jwt-assertion": token };
  const memory = memoryStorage({
    [CATALOG_FILE]: JSON.stringify({
      version: CATALOG_VERSION,
      books: [browserBook, oldSyncBook],
    } satisfies Catalog),
    "book-browser/metadata.json": "{}",
    "book-browser/browser.epub": "b",
    "sync-old/metadata.json": "{}",
    "sync-old/sync-old.epub": "o",
    ".readlet/progress/reader.json": '{"books":{"sync-old":{"page":3}}}',
  });
  setServices(createServices(memory.storage, nullCache()));

  try {
    for (const [key, body, contentType] of [
      ["sync-new/metadata.json", "{}", "application/json"],
      ["sync-new/sync-new.epub", "book", "application/epub+zip"],
    ] as const) {
      const response = await upload(
        new Request("https://shelf.test/api/library/sync", {
          method: "PUT",
          headers: {
            ...headers,
            "content-length": String(body.length),
            "content-type": contentType,
            "x-readlet-key": key,
          },
          body,
        }),
      );
      assert.equal(response.status, 204);
    }

    const response = await publish(
      new Request("https://shelf.test/api/library/sync", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          version: CATALOG_VERSION,
          books: [newSyncBook],
        } satisfies Catalog),
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
      memory
        .json<Catalog>(CATALOG_FILE)
        .books.map((book) => book.id)
        .sort(),
      ["book-browser", "sync-new"],
    );
    assert.equal(memory.has("book-browser/browser.epub"), true);
    assert.equal(memory.has("sync-new/sync-new.epub"), true);
    assert.equal(memory.has("sync-old/sync-old.epub"), false);
    assert.deepEqual(memory.json(".readlet/progress/reader.json"), {
      books: { "sync-old": { page: 3 } },
    });
  } finally {
    setServices(null);
    access.stop();
  }
});
