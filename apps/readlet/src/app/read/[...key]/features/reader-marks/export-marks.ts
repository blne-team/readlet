import type { ReaderMark } from "@/domain/reader-marks";

export type MarksExport = {
  bookId: string;
  title?: string;
  exportedAt: string;
  marks: ReaderMark[];
};

export function marksExportFilename(
  bookId: string,
  format: "json" | "md",
): string {
  return `${bookId}-marks.${format}`;
}

export function serializeMarksJson(input: MarksExport): string {
  return `${JSON.stringify(jsonPayload(input), null, 2)}\n`;
}

export function serializeMarksMarkdown(input: MarksExport): string {
  const highlights = input.marks.filter((mark) => mark.type === "highlight");
  const bookmarks = input.marks.filter((mark) => mark.type === "bookmark");
  const lines = [
    `# ${input.title || input.bookId}`,
    "",
    `- Book ID: \`${input.bookId}\``,
    `- Exported: ${input.exportedAt}`,
    "",
    "## Highlights",
    "",
    ...(highlights.length === 0
      ? ["None.", ""]
      : highlights.flatMap((mark) => highlightSection(mark))),
    "## Bookmarks",
    "",
    ...(bookmarks.length === 0
      ? ["None.", ""]
      : bookmarks.flatMap((mark) => bookmarkSection(mark))),
  ];
  return `${lines.join("\n")}`;
}

function jsonPayload(input: MarksExport) {
  return {
    bookId: input.bookId,
    ...(input.title ? { title: input.title } : {}),
    exportedAt: input.exportedAt,
    marks: input.marks,
  };
}

function highlightSection(
  mark: Extract<ReaderMark, { type: "highlight" }>,
): string[] {
  const lines = [
    `### ${colorLabel(mark.color)}`,
    "",
    blockquote(mark.text),
    "",
  ];
  if (mark.note) {
    lines.push(`Note: ${mark.note}`, "");
  }
  lines.push(`- Created: ${mark.createdAt}`, ...anchorLines(mark.anchor), "");
  return lines;
}

function bookmarkSection(
  mark: Extract<ReaderMark, { type: "bookmark" }>,
): string[] {
  return [
    `### ${mark.text || "Bookmark"}`,
    "",
    `- Created: ${mark.createdAt}`,
    ...anchorLines(mark.anchor),
    "",
  ];
}

function anchorLines(anchor: ReaderMark["anchor"]): string[] {
  if (anchor.format === "epub") {
    const lines = [`- EPUB CFI: \`${anchor.cfi}\``];
    if (anchor.href) lines.push(`- EPUB href: \`${anchor.href}\``);
    return lines;
  }
  return [`- PDF page: ${anchor.page}`];
}

function colorLabel(color: string): string {
  return `${color.charAt(0).toUpperCase()}${color.slice(1)}`;
}

function blockquote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}
