"use client";

import { ChevronDown, ChevronUp, Search as SearchIcon, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useId, useMemo, useRef } from "react";
import { BUTTON_ROUND, INPUT } from "@/app/ui";
import type { Search } from "./features/search/pdf-search";
import type { OutlineEntry } from "./pdf-document";
import { PdfThumbnails } from "./pdf-thumbnails";
import type { PdfFindSnapshot } from "./pdf-types";

export type Panel = "thumbnails" | "contents" | "search";

export function PdfSidebar({
  panel,
  document,
  labels,
  outline,
  page,
  search,
  find,
  onGo,
  onOpenOutline,
  onFindAgain,
  onClose,
}: {
  panel: Panel;
  document: PDFDocumentProxy;
  labels: string[] | null;
  outline: OutlineEntry[];
  page: number;
  search: Search;
  find: PdfFindSnapshot;
  onGo: (page: number) => void;
  onOpenOutline: (entry: OutlineEntry) => void;
  onFindAgain: (previous: boolean) => void;
  onClose: () => void;
}) {
  const field = useId();
  const searchField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (panel === "search") searchField.current?.focus();
  }, [panel]);
  const activeOutline = useMemo(() => {
    let found: number | null = null;
    for (const entry of outline) {
      if (entry.page !== null && entry.page <= page) found = entry.id;
    }
    return found;
  }, [outline, page]);

  const title = {
    thumbnails: "Page thumbnails",
    contents: "Contents",
    search: "Search in this book",
  }[panel];

  return (
    <aside
      aria-label={title}
      className="reader-side-panel fixed inset-y-0 left-0 z-40 flex w-80 max-w-[calc(100vw-2rem)] shrink-0 flex-col border-r border-separator bg-background shadow-page xl:static xl:w-72 xl:shadow-none"
    >
      <header className="flex min-h-13 items-center justify-between gap-3 border-b border-separator px-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={BUTTON_ROUND}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>

      {panel === "search" && (
        <div className="border-b border-separator p-3">
          <label htmlFor={field} className="sr-only">
            Search in this book
          </label>
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tertiary"
            />
            <input
              ref={searchField}
              id={field}
              type="search"
              value={search.query}
              onChange={(event) => search.setQuery(event.target.value)}
              placeholder="Search in this book"
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") onFindAgain(event.shiftKey);
              }}
              className={`${INPUT} w-full pl-8`}
            />
          </div>
          <div className="mt-2 flex min-h-8 items-center justify-between gap-2 px-0.5">
            <p className="text-xs text-tertiary">
              <SearchStatus search={search} find={find} />
            </p>
            {find.total > 0 && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onFindAgain(true)}
                  aria-label="Previous result"
                  className={BUTTON_ROUND}
                >
                  <ChevronUp aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onFindAgain(false)}
                  aria-label="Next result"
                  className={BUTTON_ROUND}
                >
                  <ChevronDown aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {panel === "thumbnails" ? (
          <PdfThumbnails
            document={document}
            page={page}
            labels={labels}
            onGo={onGo}
          />
        ) : panel === "contents" ? (
          outline.length === 0 ? (
            <Empty>This PDF does not contain a table of contents.</Empty>
          ) : (
            <ul className="py-2">
              {outline.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    disabled={!entry.destination && entry.page === null}
                    onClick={() => onOpenOutline(entry)}
                    aria-current={
                      entry.id === activeOutline ? "true" : undefined
                    }
                    className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[13px] leading-snug transition-colors enabled:hover:bg-fill disabled:text-tertiary ${
                      entry.id === activeOutline
                        ? "font-medium text-accent"
                        : "text-secondary"
                    }`}
                    style={{ paddingLeft: `${0.75 + entry.depth * 0.875}rem` }}
                  >
                    <span className="min-w-0 flex-1">{entry.title}</span>
                    {entry.page !== null && (
                      <span className="shrink-0 text-xs tabular-nums text-tertiary">
                        {labels?.[entry.page - 1] ?? entry.page}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : search.needle === "" ? (
          <Empty>Type at least two letters to search the whole book.</Empty>
        ) : search.failed ? (
          <Empty>This document's text could not be searched.</Empty>
        ) : search.hits.length === 0 && !search.running ? (
          <Empty>Nothing in this book matches “{search.query.trim()}”.</Empty>
        ) : (
          <ul className="py-2">
            {search.hits.map((hit) => (
              <li key={`${hit.page}-${hit.at}`}>
                <button
                  type="button"
                  onClick={() => onGo(hit.page)}
                  className="w-full px-3 py-2 text-left transition-colors hover:bg-fill"
                >
                  <span className="mb-0.5 block text-xs tabular-nums text-tertiary">
                    Page {labels?.[hit.page - 1] ?? hit.page}
                  </span>
                  <span className="block text-[13px] leading-snug text-secondary">
                    {hit.before}
                    <mark className="rounded-[3px] bg-accent/20 text-foreground">
                      {hit.match}
                    </mark>
                    {hit.after}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-4 text-[13px] leading-relaxed text-tertiary">
      {children}
    </p>
  );
}

function SearchStatus({
  search,
  find,
}: {
  search: Search;
  find: PdfFindSnapshot;
}) {
  if (search.needle === "") return null;
  if (search.failed) return "Search could not read this document";
  if (find.pending || search.running) {
    return `${search.hits.length} so far · page ${search.scanned}`;
  }
  if (search.truncated)
    return `${search.hits.length}+ results · narrow the search`;
  if (find.total > 0) return `${find.current} of ${find.total}`;
  const count = search.hits.length;
  return `${count} ${count === 1 ? "result" : "results"}`;
}
