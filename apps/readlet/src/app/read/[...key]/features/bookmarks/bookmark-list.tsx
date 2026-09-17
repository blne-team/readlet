"use client";

import { Bookmark } from "lucide-react";
import type { BookmarkMark, ReaderMark } from "@/domain/reader-marks";

export function BookmarkList({
  marks,
  writable,
  onGo,
  onRemove,
}: {
  marks: BookmarkMark[];
  writable: boolean;
  onGo: (mark: ReaderMark) => void;
  onRemove: (id: string) => void;
}) {
  if (marks.length === 0) return null;
  return (
    <section aria-labelledby="bookmarks-heading">
      <h3
        id="bookmarks-heading"
        className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary"
      >
        Bookmarks
      </h3>
      <ul className="space-y-3">
        {marks.map((mark) => (
          <li key={mark.id} className="rounded-lg border border-separator p-3">
            <button
              type="button"
              onClick={() => onGo(mark)}
              className="flex w-full items-start gap-2 text-left text-sm"
            >
              <Bookmark
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-accent"
              />
              <span className="line-clamp-3">
                {mark.text ||
                  (mark.anchor.format === "pdf"
                    ? `Page ${mark.anchor.page}`
                    : "Bookmark")}
              </span>
            </button>
            {writable && (
              <button
                type="button"
                onClick={() => onRemove(mark.id)}
                className="mt-3 text-xs text-secondary hover:text-foreground"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
