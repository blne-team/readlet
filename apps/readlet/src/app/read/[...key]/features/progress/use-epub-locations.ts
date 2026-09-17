"use client";

import type { Book } from "epubjs";
import { useEffect, useState } from "react";
import type { EpubLocations, SpineEntry } from "./epub-progress";

/** Characters between samples; matches epub.js Locations.break. */
const LOCATION_CHAR_BREAK = 150;

const generatedLocations = new Map<string, string>();

/**
 * Builds the epub.js location map once per opened book. Layout rebuilds of the
 * same OPF reuse the cached samples instead of fetching every chapter again.
 * Generation failure leaves percents unknown — it does not invent 0%.
 */
export function useEpubLocations(
  book: Book | null,
  bookKey: string,
): {
  locations: EpubLocations | null;
  spine: SpineEntry[];
} {
  const [locations, setLocations] = useState<EpubLocations | null>(null);
  const [spine, setSpine] = useState<SpineEntry[]>([]);

  useEffect(() => {
    if (!book) {
      setLocations(null);
      setSpine([]);
      return;
    }

    setSpine(spineEntries(book));
    const cached = generatedLocations.get(bookKey);
    if (cached) {
      book.locations.load(cached);
      setLocations(adaptLocations(book));
      return;
    }

    setLocations(null);
    let cancelled = false;
    book.locations.generate(LOCATION_CHAR_BREAK).then(
      () => {
        if (cancelled) return;
        generatedLocations.set(bookKey, book.locations.save());
        setLocations(adaptLocations(book));
      },
      (error: unknown) => {
        console.error(
          "The EPUB reader could not measure progress in this book",
          error,
        );
        if (!cancelled) setLocations(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [book, bookKey]);

  return { locations, spine };
}

function spineEntries(book: Book): SpineEntry[] {
  const items =
    (
      book.spine as unknown as {
        spineItems?: Array<{
          href?: string;
          cfiBase?: string;
          linear?: string;
        }>;
      }
    ).spineItems ?? [];
  return items.map((item) => ({
    href: item.href ?? "",
    cfiBase: item.cfiBase,
    linear: item.linear,
  }));
}

function adaptLocations(book: Book): EpubLocations {
  const { locations } = book;
  return {
    get length() {
      return locations.length();
    },
    percentageFromCfi(cfi) {
      const value = locations.percentageFromCfi(cfi) as unknown;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    locationFromCfi(cfi) {
      const value = locations.locationFromCfi(cfi) as unknown;
      return typeof value === "number" ? value : -1;
    },
  };
}
