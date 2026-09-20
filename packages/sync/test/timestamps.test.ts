import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { Catalog } from "@readlet/core";
import { epub } from "@readlet/fixtures";
import { buildLibrary } from "@readlet/sync/build";

const FIRST = "2026-01-01T00:00:00.000Z";
const SECOND = "2026-02-01T00:00:00.000Z";
const THIRD = "2026-03-01T00:00:00.000Z";

async function build(author: string, generatedAt: string, previous?: Catalog) {
  const root = await mkdtemp(path.join(tmpdir(), "readlet-timestamps-"));
  const input = path.join(root, "books");
  const output = path.join(root, "library");
  await mkdir(input, { recursive: true });
  await writeFile(
    path.join(input, "tracked.epub"),
    epub({
      file: "tracked",
      title: "Tracked",
      authors: [author],
      published: "2020",
      colour: [10, 20, 30],
    }),
  );
  const result = await buildLibrary(
    input,
    output,
    { height: 240, generatedAt, previous },
    null,
    () => {},
  );
  const catalog = JSON.parse(
    await readFile(path.join(output, "catalog.json"), "utf8"),
  ) as Catalog;
  return { book: result.books[0], catalog };
}

test("sync preserves added time and advances modified time only for changes", async () => {
  const first = await build("First Author", FIRST);
  assert.equal(first.book.addedAt, FIRST);
  assert.equal(first.book.modifiedAt, FIRST);

  const unchanged = await build("First Author", SECOND, first.catalog);
  assert.equal(unchanged.book.addedAt, FIRST);
  assert.equal(unchanged.book.modifiedAt, FIRST);

  const changed = await build("Second Author", THIRD, first.catalog);
  assert.equal(changed.book.addedAt, FIRST);
  assert.equal(changed.book.modifiedAt, THIRD);
});
