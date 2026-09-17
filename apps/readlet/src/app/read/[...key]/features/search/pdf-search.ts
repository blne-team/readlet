"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 500;
const UPDATE_INTERVAL = 8;
const EXCERPT_BEFORE = 56;
const EXCERPT_AFTER = 104;
const DIACRITICS = /\p{Diacritic}/gu;

export type FoldedText = { folded: string; map: number[] };

/** Normalizes matching text while retaining offsets into the original string. */
export function fold(text: string): FoldedText {
  let folded = "";
  const map: number[] = [];
  let inWhitespace = false;

  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      if (!inWhitespace && folded.length > 0) {
        folded += " ";
        map.push(index);
        inWhitespace = true;
      }
      continue;
    }
    inWhitespace = false;

    if (code < 0x80) {
      folded +=
        code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : text[index];
      map.push(index);
      continue;
    }

    const normalized = text[index]
      .normalize("NFKD")
      .replace(DIACRITICS, "")
      .toLowerCase();
    for (const piece of normalized) {
      folded += piece;
      map.push(index);
    }
  }

  return { folded, map };
}

export type Hit = {
  page: number;
  at: number;
  before: string;
  match: string;
  after: string;
};

function excerptBefore(text: string, start: number): string {
  const from = Math.max(0, start - EXCERPT_BEFORE);
  const excerpt = text.slice(from, start).replace(/\s+/gu, " ");
  if (from === 0) return excerpt.trimStart();
  const boundary = excerpt.indexOf(" ");
  return boundary === -1 ? "" : `…${excerpt.slice(boundary + 1)}`;
}

function excerptAfter(text: string, end: number): string {
  const to = Math.min(text.length, end + EXCERPT_AFTER);
  const excerpt = text.slice(end, to).replace(/\s+/gu, " ");
  if (to === text.length) return excerpt.trimEnd();
  const boundary = excerpt.lastIndexOf(" ");
  return boundary === -1 ? excerpt.trimEnd() : `${excerpt.slice(0, boundary)}…`;
}

/** Finds non-overlapping occurrences and produces excerpts in original text. */
export function findOnPage(
  page: number,
  text: string,
  indexed: FoldedText,
  query: string,
): Hit[] {
  if (!query) return [];

  const hits: Hit[] = [];
  let index = indexed.folded.indexOf(query);
  while (index !== -1) {
    const start = indexed.map[index] ?? 0;
    const last = indexed.map[index + query.length - 1] ?? start;
    const end = Math.min(text.length, last + 1);
    hits.push({
      page,
      at: start,
      before: excerptBefore(text, start),
      match: text.slice(start, end).replace(/\s+/gu, " "),
      after: excerptAfter(text, end),
    });
    index = indexed.folded.indexOf(query, index + query.length);
  }
  return hits;
}

async function extractPageText(
  document: PDFDocumentProxy,
  pageNumber: number,
): Promise<string> {
  const content = await (await document.getPage(pageNumber)).getTextContent();
  let text = "";
  for (const item of content.items) {
    if (!("str" in item)) continue;
    text += item.str;
    if (item.hasEOL) text += "\n";
    else if (item.str && !item.str.endsWith(" ")) text += " ";
  }
  return text;
}

export type Search = {
  query: string;
  setQuery: (query: string) => void;
  activeQuery: string;
  needle: string;
  hits: Hit[];
  scanned: number;
  running: boolean;
  truncated: boolean;
  failed: boolean;
};

/** Builds a reusable in-memory text index and streams matching excerpts. */
export function usePdfSearch(
  pdfDocument: PDFDocumentProxy | null,
  pages: number,
): Search {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [needle, setNeedle] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [scanned, setScanned] = useState(0);
  const [running, setRunning] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [failed, setFailed] = useState(false);
  const cache = useRef(
    new Map<number, { text: string; indexed: FoldedText }>(),
  );
  const [opened, setOpened] = useState(pdfDocument);
  if (opened !== pdfDocument) {
    setOpened(pdfDocument);
    cache.current.clear();
    setQuery("");
    setActiveQuery("");
    setNeedle("");
    setHits([]);
    setScanned(0);
    setRunning(false);
    setTruncated(false);
    setFailed(false);
  }

  useEffect(() => {
    const wanted = fold(query.trim()).folded;
    if (!pdfDocument || wanted.length < MIN_QUERY_LENGTH) {
      setActiveQuery("");
      setNeedle("");
      setHits([]);
      setScanned(0);
      setRunning(false);
      setTruncated(false);
      setFailed(false);
      return;
    }

    const controller = new AbortController();
    const scan = async () => {
      setActiveQuery(query.trim());
      setNeedle(wanted);
      setHits([]);
      setScanned(0);
      setRunning(true);
      setTruncated(false);
      setFailed(false);

      const found: Hit[] = [];
      for (let page = 1; page <= pages; page++) {
        if (controller.signal.aborted) return;
        let entry = cache.current.get(page);
        if (!entry) {
          const text = await extractPageText(pdfDocument, page);
          if (controller.signal.aborted) return;
          entry = { text, indexed: fold(text) };
          cache.current.set(page, entry);
        }
        found.push(...findOnPage(page, entry.text, entry.indexed, wanted));

        if (found.length >= MAX_RESULTS) {
          setHits(found.slice(0, MAX_RESULTS));
          setScanned(page);
          setRunning(false);
          setTruncated(true);
          return;
        }
        if (page % UPDATE_INTERVAL === 0 || page === pages) {
          setHits([...found]);
          setScanned(page);
        }
      }
      if (!controller.signal.aborted) setRunning(false);
    };
    const timer = window.setTimeout(() => {
      void scan().catch(() => {
        if (controller.signal.aborted) return;
        setRunning(false);
        setFailed(true);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [pdfDocument, pages, query]);

  const changeQuery = useCallback((value: string) => setQuery(value), []);
  return {
    query,
    setQuery: changeQuery,
    activeQuery,
    needle,
    hits,
    scanned,
    running,
    truncated,
    failed,
  };
}
