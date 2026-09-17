"use client";

import { X } from "lucide-react";
import { AnnotationList } from "@/app/read/[...key]/features/annotations/annotation-list";
import { BookmarkList } from "@/app/read/[...key]/features/bookmarks/bookmark-list";
import { BUTTON_ROUND } from "@/app/ui";
import type {
  BookmarkMark,
  HighlightMark,
  ReaderMark,
} from "@/domain/reader-marks";

export function ReaderMarksPanel({
  marks,
  error,
  writable,
  onGo,
  onNote,
  onRemove,
  onClose,
}: {
  marks: ReaderMark[];
  error: string | null;
  writable: boolean;
  onGo: (mark: ReaderMark) => void;
  onNote: (mark: HighlightMark, note: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const highlights = marks.filter(isHighlight);
  const bookmarks = marks.filter(isBookmark);
  return (
    <aside
      aria-label="Bookmarks and highlights"
      className="reader-side-panel fixed inset-y-0 left-0 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col border-r border-separator bg-background shadow-page"
    >
      <header className="flex min-h-13 items-center justify-between border-b border-separator px-3">
        <h2 className="text-sm font-medium">Bookmarks and highlights</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close marks"
          className={BUTTON_ROUND}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      {error && (
        <p role="alert" className="p-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {marks.length === 0 && (
          <p className="text-sm text-secondary">
            Select text to highlight it, or save your current place as a
            bookmark.
          </p>
        )}
        <AnnotationList
          marks={highlights}
          writable={writable}
          onGo={onGo}
          onNote={onNote}
          onRemove={onRemove}
        />
        <BookmarkList
          marks={bookmarks}
          writable={writable}
          onGo={onGo}
          onRemove={onRemove}
        />
      </div>
    </aside>
  );
}

function isHighlight(mark: ReaderMark): mark is HighlightMark {
  return mark.type === "highlight";
}

function isBookmark(mark: ReaderMark): mark is BookmarkMark {
  return mark.type === "bookmark";
}
