import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeEpubProgress,
  type EpubChapter,
  type EpubLocations,
  resolveEpubChapter,
  spineStartCfi,
} from "../src/app/read/[...key]/features/progress/epub-progress.ts";

function locations(
  entries: Record<string, { index: number; fraction: number | null }>,
): EpubLocations {
  const points = Object.values(entries);
  return {
    length: points.length,
    percentageFromCfi: (cfi) => entries[cfi]?.fraction ?? null,
    locationFromCfi: (cfi) => entries[cfi]?.index ?? -1,
  };
}

const START = "epubcfi(/6/4!/4/1:0)";
const MID = "epubcfi(/6/8!/4/2/1:12)";
const LAST = "epubcfi(/6/12!/4/2/1:80)";

const chapter: EpubChapter = {
  label: "Chapter Two",
  startCfi: "epubcfi(/6/8!/4)",
  nextCfi: "epubcfi(/6/12!/4)",
};

test("progress percents stay unknown until locations exist", () => {
  assert.deepEqual(computeEpubProgress(MID, null, chapter), {
    bookPercent: null,
    chapterPercent: null,
    chapterLabel: "Chapter Two",
  });
  assert.deepEqual(
    computeEpubProgress(
      MID,
      { length: 0, percentageFromCfi: () => 0, locationFromCfi: () => 0 },
      chapter,
    ),
    {
      bookPercent: null,
      chapterPercent: null,
      chapterLabel: "Chapter Two",
    },
  );
});

test("a single location cannot form a percentage", () => {
  const one: EpubLocations = {
    length: 1,
    percentageFromCfi: () => 0,
    locationFromCfi: () => 0,
  };
  assert.equal(computeEpubProgress(START, one, chapter).bookPercent, null);
  assert.equal(computeEpubProgress(START, one, chapter).chapterPercent, null);
});

test("book percent is a rounded 0–100 integer once locations are ready", () => {
  const index = locations({
    [START]: { index: 0, fraction: 0 },
    [MID]: { index: 40, fraction: 0.404 },
    [LAST]: { index: 99, fraction: 1 },
  });

  assert.equal(computeEpubProgress(START, index, chapter).bookPercent, 0);
  assert.equal(computeEpubProgress(MID, index, chapter).bookPercent, 40);
  assert.equal(computeEpubProgress(LAST, index, chapter).bookPercent, 100);
});

test("chapter percent is local to the chapter's location span", () => {
  const index = locations({
    [MID]: { index: 40, fraction: 0.4 },
    "epubcfi(/6/8!/4)": { index: 30, fraction: 0.3 },
    "epubcfi(/6/12!/4)": { index: 50, fraction: 0.5 },
  });

  const progress = computeEpubProgress(MID, index, chapter);
  assert.equal(progress.chapterPercent, 50);
  assert.equal(progress.chapterLabel, "Chapter Two");
});

test("the last chapter runs to the end of the location list", () => {
  const lastChapter: EpubChapter = {
    label: "Endnotes",
    startCfi: "epubcfi(/6/12!/4)",
    nextCfi: null,
  };
  const index = locations({
    [LAST]: { index: 90, fraction: 0.9 },
    "epubcfi(/6/12!/4)": { index: 80, fraction: 0.8 },
  });
  Object.assign(index, { length: 100 });

  assert.equal(
    computeEpubProgress(LAST, index, lastChapter).chapterPercent,
    50,
  );
});

test("the final visible page reaches 100% even when its start CFI is earlier", () => {
  const lastChapter: EpubChapter = {
    label: "Endnotes",
    startCfi: "epubcfi(/6/12!/4)",
    nextCfi: null,
  };
  const index = locations({
    [LAST]: { index: 90, fraction: 0.9 },
    "epubcfi(/6/12!/4)": { index: 80, fraction: 0.8 },
  });
  Object.assign(index, { length: 100 });

  assert.equal(computeEpubProgress(LAST, index, lastChapter).bookPercent, 90);
  assert.equal(
    computeEpubProgress(LAST, index, lastChapter).chapterPercent,
    50,
  );
  assert.deepEqual(computeEpubProgress(LAST, index, lastChapter, true), {
    bookPercent: 100,
    chapterPercent: 100,
    chapterLabel: "Endnotes",
  });
  assert.equal(
    computeEpubProgress(LAST, null, lastChapter, true).bookPercent,
    null,
  );
});

test("a missing CFI does not invent a percentage", () => {
  const index = locations({
    [MID]: { index: 40, fraction: 0.4 },
  });
  assert.deepEqual(computeEpubProgress(undefined, index, chapter), {
    bookPercent: null,
    chapterPercent: null,
    chapterLabel: "Chapter Two",
  });
  assert.equal(
    computeEpubProgress("epubcfi(/unknown)", index, chapter).bookPercent,
    null,
  );
  assert.equal(
    computeEpubProgress("epubcfi(/unknown)", index, chapter).chapterPercent,
    null,
  );
});

test("chapter lookup uses the TOC title for the current spine href", () => {
  const toc = [
    { href: "OEBPS/one.xhtml", label: " One " },
    { href: "two.xhtml#start", label: "Two" },
    { href: "two.xhtml#later", label: "Two, continued" },
    { href: "three.xhtml", label: "Three" },
  ];
  const spine = [
    { href: "OEBPS/one.xhtml", cfiBase: "/6/4[one]" },
    { href: "OEBPS/two.xhtml", cfiBase: "/6/8[two]" },
    { href: "OEBPS/three.xhtml", cfiBase: "/6/12[three]" },
  ];

  assert.deepEqual(resolveEpubChapter("OEBPS/two.xhtml", toc, spine), {
    label: "Two",
    startCfi: "epubcfi(/6/8[two]!/4)",
    nextCfi: "epubcfi(/6/12[three]!/4)",
  });
  assert.equal(resolveEpubChapter("two.xhtml", toc, spine)?.label, "Two");
  assert.deepEqual(resolveEpubChapter("OEBPS/three.xhtml", toc, spine), {
    label: "Three",
    startCfi: "epubcfi(/6/12[three]!/4)",
    nextCfi: null,
  });
});

test("a spine href with no TOC entry still labels the file", () => {
  const chapter = resolveEpubChapter(
    "OEBPS/preface.xhtml",
    [{ href: "chapter.xhtml", label: "Chapter" }],
    [{ href: "OEBPS/preface.xhtml", cfiBase: "/6/2[pre]" }],
  );
  assert.equal(chapter?.label, "preface.xhtml");
  assert.equal(chapter?.startCfi, "epubcfi(/6/2[pre]!/4)");
});

test("linear=no spine items are skipped when bounding a chapter", () => {
  const chapter = resolveEpubChapter(
    "ch1.xhtml",
    [{ href: "ch1.xhtml", label: "I" }],
    [
      { href: "cover.xhtml", cfiBase: "/6/2[cover]", linear: "no" },
      { href: "ch1.xhtml", cfiBase: "/6/4[ch1]" },
      { href: "notes.xhtml", cfiBase: "/6/6[notes]", linear: "no" },
      { href: "ch2.xhtml", cfiBase: "/6/8[ch2]" },
    ],
  );
  assert.deepEqual(chapter, {
    label: "I",
    startCfi: "epubcfi(/6/4[ch1]!/4)",
    nextCfi: "epubcfi(/6/8[ch2]!/4)",
  });
});

test("spineStartCfi wraps a package path as a document-start CFI", () => {
  assert.equal(spineStartCfi("/6/14[ch3]"), "epubcfi(/6/14[ch3]!/4)");
});
