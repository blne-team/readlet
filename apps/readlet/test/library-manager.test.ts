import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  type Book,
  CATALOG_FILE,
  CATALOG_VERSION,
  type Catalog,
  LIBRARY_OPERATIONS_FILE,
  progressFile,
  readerMarksFile,
  USERS_FILE,
  type User,
  type UserDirectory,
} from "@readlet/core";
import { bookPdf, epub } from "@readlet/fixtures";
import { resetCatalogMemo } from "../src/services/catalog.ts";
import { createServices } from "../src/services/container.ts";
import { ReadOnlyLibraryError } from "../src/services/library-manager.ts";
import { memoryStorage, nullCache, recordingCache } from "./lib/storage.ts";

beforeEach(resetCatalogMemo);

const manager: User = {
  id: "u-11111111-1111-4111-8111-111111111111",
  accessSubject: "cf-manager",
  email: "manager@example.com",
  displayName: "Manager",
  role: "manager",
  status: "active",
  createdAt: new Date(0).toISOString(),
  createdBy: "u-11111111-1111-4111-8111-111111111111",
};

function book(id: string, title: string): Book {
  return {
    id,
    addedAt: new Date(0).toISOString(),
    modifiedAt: new Date(0).toISOString(),
    title,
    authors: ["A. Reader"],
    cover: "cover.webp",
    formats: [
      { format: "epub", file: `${id}.epub`, size: 12 },
      { format: "pdf", file: `${id}.pdf`, size: 34 },
    ],
  };
}

function objects(books: Book[]): Record<string, string> {
  const stored: Record<string, string> = {
    [CATALOG_FILE]: JSON.stringify({
      version: CATALOG_VERSION,
      books,
    } satisfies Catalog),
    [USERS_FILE]: JSON.stringify({
      version: 1,
      users: [manager],
    } satisfies UserDirectory),
  };
  for (const entry of books) {
    stored[`${entry.id}/metadata.json`] = "{}";
    stored[`${entry.id}/cover.webp`] = "cover";
    stored[`${entry.id}/${entry.id}.epub`] = "epub";
    stored[`${entry.id}/${entry.id}.pdf`] = "pdf";
  }
  return stored;
}

function stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

test("deletes one catalogued book and all state that belongs to it", async () => {
  const removed = book("removed", "Removed Book");
  const kept = book("kept", "Kept Book");
  const memory = memoryStorage({
    ...objects([removed, kept]),
    [progressFile(manager.id)]: JSON.stringify({
      version: 1,
      books: {
        removed: { page: 12, updatedAt: new Date(0).toISOString() },
        kept: { page: 3, updatedAt: new Date(0).toISOString() },
      },
    }),
    [readerMarksFile(manager.id)]: JSON.stringify({
      version: 1,
      books: {
        removed: {
          mark: {
            id: "mark",
            type: "bookmark",
            anchor: { format: "pdf", page: 12 },
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
        },
      },
    }),
  });
  const recorded = recordingCache();
  const services = createServices(memory.storage, recorded.cache);

  // Exercise both cache tiers before the mutation invalidates them.
  assert.equal((await services.catalog.all()).length, 2);
  await services.library.removeBook(manager, removed.id);

  assert.deepEqual(
    memory.json<Catalog>(CATALOG_FILE).books.map((entry) => entry.id),
    [kept.id],
  );
  for (const key of [
    "removed/metadata.json",
    "removed/cover.webp",
    "removed/removed.epub",
    "removed/removed.pdf",
  ]) {
    assert.equal(memory.has(key), false, key);
  }
  assert.equal(memory.has("kept/kept.epub"), true);
  assert.deepEqual(
    Object.keys(
      memory.json<{ books: Record<string, unknown> }>(progressFile(manager.id))
        .books,
    ),
    [kept.id],
  );
  assert.deepEqual(
    memory.json<{ books: Record<string, unknown> }>(readerMarksFile(manager.id))
      .books,
    {},
  );
  assert.deepEqual(
    memory.json<{ deletions: Record<string, unknown> }>(LIBRARY_OPERATIONS_FILE)
      .deletions,
    {},
  );
  assert.ok(recorded.calls.some((call) => call.op === "remove"));
  assert.deepEqual(
    (await services.catalog.all()).map((entry) => entry.id),
    [kept.id],
  );

  const catalogWrite = memory.writes.findIndex(
    (write) => write.key === CATALOG_FILE,
  );
  const firstBookDelete = memory.writes.findIndex(
    (write) => write.removed && write.key.startsWith("removed/"),
  );
  assert.ok(catalogWrite >= 0 && catalogWrite < firstBookDelete);
});

test("an interrupted cleanup stays resumable after the book leaves the catalog", async () => {
  const doomed = book("doomed", "Doomed Book");
  const memory = memoryStorage(objects([doomed]));
  const services = createServices(memory.storage, nullCache());

  memory.fail("remove");
  await assert.rejects(services.library.removeBook(manager, doomed.id));
  assert.deepEqual(memory.json<Catalog>(CATALOG_FILE).books, []);
  assert.equal(
    (await services.library.pendingDeletions())[0]?.book.id,
    doomed.id,
  );

  memory.heal();
  await services.library.removeBook(manager, doomed.id);
  assert.deepEqual(await services.library.pendingDeletions(), []);
  assert.equal(memory.has("doomed/doomed.epub"), false);
});

test("catalog removal can finish before file and reader-state cleanup", async () => {
  const entry = book("staged", "Staged Book");
  const memory = memoryStorage(objects([entry]));
  const services = createServices(memory.storage, nullCache());

  await services.library.beginBookDeletion(manager, entry.id);
  assert.deepEqual(memory.json<Catalog>(CATALOG_FILE).books, []);
  assert.equal(memory.has("staged/staged.epub"), true);
  assert.equal(
    (await services.library.pendingDeletions())[0]?.book.id,
    entry.id,
  );

  await services.library.finishBookDeletion(manager, entry.id);
  await services.library.finishBookDeletion(manager, entry.id);
  assert.equal(memory.has("staged/staged.epub"), false);
  assert.deepEqual(await services.library.pendingDeletions(), []);
});

test("only catalogued book files can become deletion targets", async () => {
  const memory = memoryStorage(objects([book("kept", "Kept Book")]));
  const services = createServices(memory.storage, nullCache());

  await assert.rejects(
    services.library.removeBook(manager, "../../.readlet/users.json"),
    /no longer exists/,
  );
  assert.equal(memory.has(USERS_FILE), true);
  assert.deepEqual(memory.writes, []);
});

test("members cannot delete books through the service", async () => {
  const member: User = {
    ...manager,
    id: "u-22222222-2222-4222-8222-222222222222",
    accessSubject: "cf-member",
    email: "member@example.com",
    displayName: "Member",
    role: "member",
    createdBy: manager.id,
  };
  const entry = book("kept", "Kept Book");
  const memory = memoryStorage({
    ...objects([entry]),
    [USERS_FILE]: JSON.stringify({
      version: 1,
      users: [manager, member],
    } satisfies UserDirectory),
  });
  const services = createServices(memory.storage, nullCache());

  await assert.rejects(
    services.library.removeBook(member, entry.id),
    /Manager access is required/,
  );
  assert.equal(memory.has("kept/kept.epub"), true);
  assert.deepEqual(memory.writes, []);
});

test("read-only libraries refuse deletion before changing state", async () => {
  const entry = book("kept", "Kept Book");
  const memory = memoryStorage(objects([entry]), { writable: false });
  const services = createServices(memory.storage, nullCache());

  assert.equal(services.library.writable, false);
  await assert.rejects(
    services.library.removeBook(manager, entry.id),
    ReadOnlyLibraryError,
  );
  assert.equal(memory.has("kept/kept.epub"), true);
});

test("imports an EPUB and PDF into the catalog", async () => {
  const memory = memoryStorage(objects([]));
  const services = createServices(memory.storage, nullCache());
  const files = [
    {
      name: "story.epub",
      bytes: epub({ title: "Imported Story", authors: ["A. Writer"] }),
    },
    {
      name: "notes.pdf",
      bytes: bookPdf({ title: "Imported Notes", authors: ["B. Writer"] }),
    },
  ];
  for (const { name, bytes } of files) {
    const book = await services.library.importBook(
      manager,
      name,
      stream(bytes),
      bytes.byteLength,
    );
    assert.equal(memory.has(`${book.id}/${book.formats[0].file}`), true);
    assert.equal(memory.has(`${book.id}/metadata.json`), true);
  }
  assert.deepEqual(
    (await services.catalog.all()).map((entry) => entry.title),
    ["Imported Notes", "Imported Story"],
  );
});

test("a malformed import is removed without entering the catalog", async () => {
  const memory = memoryStorage(objects([]));
  const services = createServices(memory.storage, nullCache());
  const bytes = new TextEncoder().encode("not an epub");
  await assert.rejects(
    services.library.importBook(
      manager,
      "bad.epub",
      stream(bytes),
      bytes.byteLength,
    ),
  );
  assert.deepEqual(await services.catalog.all(), []);
  assert.equal(
    Object.keys(memory.contents()).some((key) => key.startsWith("book-")),
    false,
  );
});

test("an import larger than its stated size is not published", async () => {
  const memory = memoryStorage(objects([]));
  const services = createServices(memory.storage, nullCache());
  const bytes = epub({ title: "Oversized" });
  await assert.rejects(
    services.library.importBook(
      manager,
      "oversized.epub",
      stream(bytes),
      bytes.byteLength - 1,
    ),
  );
  assert.deepEqual(await services.catalog.all(), []);
  assert.equal(
    Object.keys(memory.contents()).some((key) => key.startsWith("book-")),
    false,
  );
});
