"use client";

import type { NavItem } from "epubjs";
import { Bookmark, ChevronLeft, ChevronRight, Highlighter } from "lucide-react";
import { BUTTON_ROUND, SELECT } from "@/app/ui";
import type { EpubPreferences } from "./features/appearance/epub-preferences";
import { EpubSettings } from "./features/appearance/epub-settings";
import {
  EpubBookPercent,
  EpubChapterPercent,
} from "./features/progress/epub-progress-chrome";

export function EpubControls({
  toc,
  label,
  bookPercent,
  chapterPercent,
  preferences,
  marksWritable,
  onTurn,
  onGo,
  onPreferences,
  onBookmark,
  onMarks,
  settingsOpen,
  onSettingsOpen,
  onActivity,
}: {
  toc: { item: NavItem; depth: number }[];
  label: string;
  bookPercent: number | null;
  chapterPercent: number | null;
  preferences: EpubPreferences;
  marksWritable: boolean;
  onTurn: (direction: "prev" | "next") => void;
  onGo: (href: string) => void;
  onPreferences: (preferences: EpubPreferences) => void;
  onBookmark: () => void;
  onMarks: () => void;
  settingsOpen: boolean;
  onSettingsOpen: (open: boolean) => void;
  onActivity: () => void;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: these delegated events only restart the mobile chrome's idle timer; each control retains its native semantics.
    <div
      className="reader-bottom-bar flex shrink-0 items-center gap-1 border-t border-separator pt-2.5 sm:justify-between sm:gap-3 sm:pt-3"
      onFocus={onActivity}
      onInput={onActivity}
      onKeyDown={onActivity}
      onPointerDown={onActivity}
    >
      <button
        type="button"
        onClick={() => onTurn("prev")}
        aria-label="Previous page"
        className={BUTTON_ROUND}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      {toc.length > 0 ? (
        <div className="min-w-0 flex-1">
          <select
            aria-label="Jump to chapter"
            value=""
            onChange={(event) => {
              if (event.target.value) onGo(event.target.value);
            }}
            className={`${SELECT} w-full truncate`}
          >
            <option value="">{label || "Contents"}</option>
            {toc.map(({ item, depth }) => (
              <option
                key={item.href}
                value={item.href}
              >{`${"  ".repeat(depth)}${item.label.trim()}`}</option>
            ))}
          </select>
          <EpubChapterPercent percent={chapterPercent} />
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm text-secondary">{label}</span>
          <EpubChapterPercent percent={chapterPercent} />
        </div>
      )}
      <EpubBookPercent percent={bookPercent} />
      <EpubSettings
        preferences={preferences}
        open={settingsOpen}
        onOpenChange={onSettingsOpen}
        onChange={onPreferences}
      />
      <button
        type="button"
        onClick={onBookmark}
        disabled={!marksWritable}
        aria-label="Bookmark this place"
        className={BUTTON_ROUND}
      >
        <Bookmark aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        onClick={onMarks}
        aria-label="Bookmarks and highlights"
        className={BUTTON_ROUND}
      >
        <Highlighter aria-hidden="true" className="size-4" />
      </button>
      <select
        aria-label="Reading view"
        value={preferences.view}
        onChange={(event) =>
          onPreferences({
            ...preferences,
            view: event.target.value as EpubPreferences["view"],
          })
        }
        className={`${SELECT} hidden shrink-0 sm:block`}
      >
        <option value="paged">Paged</option>
        <option value="scroll">Scroll</option>
      </select>
      <button
        type="button"
        onClick={() => onTurn("next")}
        aria-label="Next page"
        className={BUTTON_ROUND}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
