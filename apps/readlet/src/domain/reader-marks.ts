export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const MAX_MARK_TEXT_LENGTH = 4096;
export const MAX_MARK_NOTE_LENGTH = 20_000;
export const MAX_PDF_HIGHLIGHT_SEGMENTS = 50;
export const MAX_PDF_HIGHLIGHT_RECTS = 100;

export type EpubAnchor = { format: "epub"; cfi: string; href?: string };
export type PdfSegment = {
  page: number;
  rects: [number, number, number, number][];
};
export type PdfAnchor = { format: "pdf"; page: number };
export type ReaderAnchor = EpubAnchor | PdfAnchor;
export type HighlightAnchor =
  | EpubAnchor
  | (PdfAnchor & { segments: PdfSegment[] });

type ReaderMarkBase = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkMark = ReaderMarkBase & {
  type: "bookmark";
  anchor: ReaderAnchor;
  text?: string;
};
export type HighlightMark = ReaderMarkBase & {
  type: "highlight";
  anchor: HighlightAnchor;
  text: string;
  note?: string;
  color: HighlightColor;
};
export type ReaderMark = BookmarkMark | HighlightMark;

/**
 * Turns data from an API or persisted marks file into the current model. Marks
 * cross two untyped JSON boundaries, so a TypeScript assertion is not enough.
 */
export function parseReaderMark(value: unknown): ReaderMark | null {
  if (!record(value)) return null;
  if (
    typeof value.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(value.id) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  )
    return null;

  const common = {
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  if (value.type === "bookmark") {
    const anchor = parseReaderAnchor(value.anchor);
    if (
      !anchor ||
      value.note !== undefined ||
      value.color !== undefined ||
      (value.text !== undefined &&
        (typeof value.text !== "string" ||
          value.text.length > MAX_MARK_TEXT_LENGTH))
    )
      return null;
    return {
      ...common,
      type: "bookmark",
      anchor,
      ...(typeof value.text === "string" ? { text: value.text } : {}),
    };
  }
  if (
    value.type !== "highlight" ||
    typeof value.text !== "string" ||
    value.text.length === 0 ||
    value.text.length > MAX_MARK_TEXT_LENGTH ||
    (value.note !== undefined &&
      (typeof value.note !== "string" ||
        value.note.length > MAX_MARK_NOTE_LENGTH))
  )
    return null;

  const anchor = parseHighlightAnchor(value.anchor);
  const color = HIGHLIGHT_COLORS.find((item) => item === value.color);
  if (!anchor || !color) return null;
  return {
    ...common,
    type: "highlight",
    anchor,
    text: value.text,
    color,
    ...(typeof value.note === "string" ? { note: value.note } : {}),
  };
}

function parseReaderAnchor(value: unknown): ReaderAnchor | null {
  if (!record(value)) return null;
  if (value.format === "epub") {
    if (
      typeof value.cfi !== "string" ||
      value.cfi.length === 0 ||
      value.cfi.length > 2048 ||
      (value.href !== undefined && typeof value.href !== "string")
    )
      return null;
    return {
      format: "epub",
      cfi: value.cfi,
      ...(typeof value.href === "string" ? { href: value.href } : {}),
    };
  }
  if (
    value.format !== "pdf" ||
    !Number.isInteger(value.page) ||
    (value.page as number) < 1
  )
    return null;
  return { format: "pdf", page: value.page as number };
}

function parseHighlightAnchor(value: unknown): HighlightAnchor | null {
  const base = parseReaderAnchor(value);
  if (!base) return null;
  if (base.format === "epub") return base;
  if (!record(value)) return null;

  if (validPdfSegments(value.segments)) {
    return { ...base, segments: value.segments };
  }
  return null;
}

function validPdfSegments(value: unknown): value is PdfSegment[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_PDF_HIGHLIGHT_SEGMENTS &&
    value.every(
      (segment: unknown) =>
        record(segment) &&
        Number.isInteger(segment.page) &&
        (segment.page as number) >= 1 &&
        validPdfRects(segment.rects),
    )
  );
}

function validPdfRects(
  value: unknown,
): value is [number, number, number, number][] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_PDF_HIGHLIGHT_RECTS &&
    value.every(
      (rect: unknown) =>
        Array.isArray(rect) &&
        rect.length === 4 &&
        rect.every(
          (coordinate: unknown) =>
            typeof coordinate === "number" &&
            Number.isFinite(coordinate) &&
            coordinate >= 0 &&
            coordinate <= 1,
        ),
    )
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
