/**
 * Display math for EPUB reading progress.
 *
 * Persistence stays on CFI/href; this module only turns epub.js locations
 * into integers for the chrome. Percents are null until a location map
 * exists — never a fabricated 0%.
 */

export type EpubLocations = {
  /** Generated location points. Below 2 there is no ratio to display. */
  length: number;
  /** Book fraction 0–1 for this CFI, or null if it cannot be placed. */
  percentageFromCfi: (cfi: string) => number | null;
  /** Index of this CFI in the location list, or -1 if unknown. */
  locationFromCfi: (cfi: string) => number;
};

export type TocEntry = {
  href: string;
  label: string;
};

export type SpineEntry = {
  href: string;
  cfiBase?: string;
  linear?: string;
};

export type EpubChapter = {
  label: string;
  startCfi: string | null;
  nextCfi: string | null;
};

export type EpubProgress = {
  bookPercent: number | null;
  chapterPercent: number | null;
  chapterLabel: string;
};

/** A CFI at the start of a spine document, from that item's package path. */
export function spineStartCfi(cfiBase: string): string {
  return `epubcfi(${cfiBase}!/4)`;
}

export function resolveEpubChapter(
  href: string | undefined,
  toc: TocEntry[],
  spine: SpineEntry[],
): EpubChapter {
  const label = labelForHref(href, toc);
  if (!href) return { label, startCfi: null, nextCfi: null };

  const readable = spine.filter((item) => item.linear !== "no");
  const index = readable.findIndex((item) =>
    pathsMatch(hrefPath(item.href), hrefPath(href)),
  );
  if (index < 0) return { label, startCfi: null, nextCfi: null };

  const current = readable[index];
  const next = readable[index + 1];
  return {
    label,
    startCfi: current?.cfiBase ? spineStartCfi(current.cfiBase) : null,
    nextCfi: next?.cfiBase ? spineStartCfi(next.cfiBase) : null,
  };
}

export function computeEpubProgress(
  currentCfi: string | undefined,
  locations: EpubLocations | null,
  chapter: EpubChapter | null,
): EpubProgress {
  const chapterLabel = chapter?.label ?? "";
  if (!locations || locations.length < 2) {
    return { bookPercent: null, chapterPercent: null, chapterLabel };
  }

  return {
    bookPercent: bookPercent(currentCfi, locations),
    chapterPercent: chapterPercent(currentCfi, locations, chapter),
    chapterLabel,
  };
}

function bookPercent(
  currentCfi: string | undefined,
  locations: EpubLocations,
): number | null {
  if (!currentCfi) return null;
  const fraction = locations.percentageFromCfi(currentCfi);
  if (fraction === null || !Number.isFinite(fraction)) return null;
  return asDisplayPercent(fraction);
}

function chapterPercent(
  currentCfi: string | undefined,
  locations: EpubLocations,
  chapter: EpubChapter | null,
): number | null {
  if (!currentCfi || !chapter?.startCfi) return null;
  const current = locations.locationFromCfi(currentCfi);
  const start = locations.locationFromCfi(chapter.startCfi);
  if (current < 0 || start < 0) return null;

  const end = chapter.nextCfi
    ? locations.locationFromCfi(chapter.nextCfi)
    : locations.length;
  if (end < 0 || end <= start) return null;

  return asDisplayPercent((current - start) / (end - start));
}

/** Integer 0–100 for display. */
function asDisplayPercent(fraction: number): number {
  return Math.min(100, Math.max(0, Math.round(fraction * 100)));
}

function labelForHref(href: string | undefined, toc: TocEntry[]): string {
  if (!href) return "";
  const path = hrefPath(href);
  const matches = toc.filter((entry) => pathsMatch(hrefPath(entry.href), path));
  const whole = matches.find((entry) => !hrefFragment(entry.href));
  const chosen = whole ?? matches[0];
  const title = chosen?.label.trim();
  if (title) return title;
  return path.split("/").pop() || href;
}

function hrefPath(href: string): string {
  const decoded = decodeHref(href.trim());
  const withoutQuery = decoded.split("?")[0] ?? decoded;
  return (withoutQuery.split("#")[0] ?? withoutQuery).replaceAll("\\", "/");
}

function hrefFragment(href: string): string {
  const decoded = decodeHref(href.trim());
  const hash = decoded.indexOf("#");
  return hash === -1 ? "" : decoded.slice(hash);
}

function pathsMatch(left: string, right: string): boolean {
  if (!left || !right) return false;
  return (
    left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`)
  );
}

function decodeHref(href: string): string {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}
