import assert from "node:assert/strict";
import { test } from "node:test";
import {
  marksExportFilename,
  serializeMarksJson,
  serializeMarksMarkdown,
} from "../src/app/read/[...key]/features/reader-marks/export-marks.ts";
import type { ReaderMark } from "../src/domain/reader-marks.ts";

const EXPORTED_AT = "2026-09-17T20:00:00.000Z";

const highlight: ReaderMark = {
  id: "hl-1",
  type: "highlight",
  anchor: { format: "epub", cfi: "epubcfi(/6/4!/4/2/1:0)", href: "ch1.xhtml" },
  text: "It is a truth universally acknowledged",
  note: "opening line",
  color: "yellow",
  createdAt: "2026-09-17T12:00:00.000Z",
  updatedAt: "2026-09-17T12:05:00.000Z",
};

const bookmark: ReaderMark = {
  id: "bm-1",
  type: "bookmark",
  anchor: { format: "pdf", page: 12 },
  text: "The storm",
  createdAt: "2026-09-17T13:00:00.000Z",
  updatedAt: "2026-09-17T13:00:00.000Z",
};

test("JSON export wraps the current book's marks without renaming them", () => {
  const body = serializeMarksJson({
    bookId: "pride-and-prejudice",
    title: "Pride and Prejudice",
    exportedAt: EXPORTED_AT,
    marks: [highlight, bookmark],
  });
  const parsed = JSON.parse(body) as {
    bookId: string;
    title: string;
    exportedAt: string;
    marks: ReaderMark[];
  };

  assert.equal(parsed.bookId, "pride-and-prejudice");
  assert.equal(parsed.title, "Pride and Prejudice");
  assert.equal(parsed.exportedAt, EXPORTED_AT);
  assert.deepEqual(parsed.marks, [highlight, bookmark]);
  assert.equal(body, `${JSON.stringify(parsed, null, 2)}\n`);
});

test("JSON export omits a missing title and allows an empty marks list", () => {
  const parsed = JSON.parse(
    serializeMarksJson({
      bookId: "a-book",
      exportedAt: EXPORTED_AT,
      marks: [],
    }),
  ) as { title?: string; marks: unknown[] };

  assert.equal("title" in parsed, false);
  assert.deepEqual(parsed.marks, []);
});

test("Markdown export lists highlights and bookmarks with anchors", () => {
  const body = serializeMarksMarkdown({
    bookId: "pride-and-prejudice",
    title: "Pride and Prejudice",
    exportedAt: EXPORTED_AT,
    marks: [bookmark, highlight],
  });

  assert.equal(
    body,
    [
      "# Pride and Prejudice",
      "",
      "- Book ID: `pride-and-prejudice`",
      "- Exported: 2026-09-17T20:00:00.000Z",
      "",
      "## Highlights",
      "",
      "### Yellow",
      "",
      "> It is a truth universally acknowledged",
      "",
      "Note: opening line",
      "",
      "- Created: 2026-09-17T12:00:00.000Z",
      "- EPUB CFI: `epubcfi(/6/4!/4/2/1:0)`",
      "- EPUB href: `ch1.xhtml`",
      "",
      "## Bookmarks",
      "",
      "### The storm",
      "",
      "- Created: 2026-09-17T13:00:00.000Z",
      "- PDF page: 12",
      "",
    ].join("\n"),
  );
});

test("Markdown export keeps empty sections honest", () => {
  const body = serializeMarksMarkdown({
    bookId: "a-book",
    exportedAt: EXPORTED_AT,
    marks: [],
  });

  assert.match(body, /^# a-book\n/);
  assert.match(body, /\n## Highlights\n\nNone\.\n/);
  assert.match(body, /\n## Bookmarks\n\nNone\.\n/);
  assert.doesNotMatch(body, /title/i);
});

test("export filenames are deterministic per book and format", () => {
  assert.equal(
    marksExportFilename("pride-and-prejudice", "json"),
    "pride-and-prejudice-marks.json",
  );
  assert.equal(
    marksExportFilename("pride-and-prejudice", "md"),
    "pride-and-prejudice-marks.md",
  );
});
