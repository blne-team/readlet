"use client";

import { BookmarkPlus, Forward } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { AnnotationList } from "@/app/read/[...key]/features/annotations/annotation-list";
import { BookmarkList } from "@/app/read/[...key]/features/bookmarks/bookmark-list";
import { BUTTON_QUIET } from "@/app/ui";
import type {
  BookmarkMark,
  HighlightMark,
  ReaderMark,
} from "@/domain/reader-marks";
import { downloadMarksExport } from "./download-marks-export";

/** Mark and note views share the reader's existing annotation actions. */
export function ReaderMarksContent({
  mode,
  bookId,
  title,
  marks,
  error,
  writable,
  onBookmark,
  onGo,
  onNote,
  onRemove,
}: {
  mode: "marks" | "notes";
  bookId: string;
  title?: string;
  marks: ReaderMark[];
  error: string | null;
  writable: boolean;
  onBookmark: () => void;
  onGo: (mark: ReaderMark) => void;
  onNote: (mark: HighlightMark, note: string) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const highlights = marks.filter(isHighlight);
  const shownHighlights =
    mode === "notes"
      ? highlights.filter((mark) => Boolean(mark.note?.trim()))
      : highlights;
  const bookmarks = marks.filter(isBookmark);

  return (
    <div className="space-y-4 p-3">
      {mode === "marks" && (
        <div className="flex flex-wrap gap-1 border-b border-separator pb-3">
          <button
            type="button"
            onClick={onBookmark}
            disabled={!writable}
            className={`${BUTTON_QUIET} gap-1.5`}
          >
            <BookmarkPlus aria-hidden="true" className="size-4" />
            Save this place
          </button>
        </div>
      )}
      {mode === "notes" && (
        <div className="flex justify-end border-b border-separator pb-3">
          <ExportMenu bookId={bookId} title={title} marks={marks} />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {mode === "notes" && shownHighlights.length === 0 ? (
        <p className="text-sm text-secondary">
          No notes yet. Add one to a highlight in Marks.
        </p>
      ) : mode === "marks" && marks.length === 0 ? (
        <p className="text-sm text-secondary">
          Select text to highlight it, or save your current place as a bookmark.
        </p>
      ) : (
        <div className="space-y-5">
          <AnnotationList
            marks={shownHighlights}
            writable={writable}
            onGo={onGo}
            onNote={onNote}
            onRemove={onRemove}
          />
          {mode === "marks" && (
            <BookmarkList
              marks={bookmarks}
              writable={writable}
              onGo={onGo}
              onRemove={onRemove}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ExportMenu({
  bookId,
  title,
  marks,
}: {
  bookId: string;
  title?: string;
  marks: ReaderMark[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function closeOutside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label="Export"
        title="Export"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-9 items-center justify-center rounded-full text-secondary transition-colors hover:bg-fill hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Forward aria-hidden="true" className="size-4" />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-separator bg-surface p-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => {
              exportCurrentBook("md", bookId, title, marks);
              setOpen(false);
            }}
            className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent"
          >
            Export Markdown
          </button>
          <button
            type="button"
            onClick={() => {
              exportCurrentBook("json", bookId, title, marks);
              setOpen(false);
            }}
            className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent"
          >
            Export JSON
          </button>
        </div>
      )}
    </div>
  );
}

function exportCurrentBook(
  format: "json" | "md",
  bookId: string,
  title: string | undefined,
  marks: ReaderMark[],
) {
  downloadMarksExport(
    { bookId, title, exportedAt: new Date().toISOString(), marks },
    format,
  );
}

function isHighlight(mark: ReaderMark): mark is HighlightMark {
  return mark.type === "highlight";
}

function isBookmark(mark: ReaderMark): mark is BookmarkMark {
  return mark.type === "bookmark";
}
