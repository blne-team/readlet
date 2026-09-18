"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { BUTTON_ROUND, SELECT } from "@/app/ui";
import type { EpubPreferences } from "./features/appearance/epub-preferences";
import { EpubSettings } from "./features/appearance/epub-settings";
import {
  EpubBookPercent,
  EpubChapterPercent,
} from "./features/progress/epub-progress-chrome";
import { ReaderHeaderActions, ReaderHeaderTools } from "./reader-shell";

export function EpubControls({
  label,
  bookPercent,
  chapterPercent,
  preferences,
  onTurn,
  onPreferences,
  settingsOpen,
  onSettingsOpen,
  onActivity,
}: {
  label: string;
  bookPercent: number | null;
  chapterPercent: number | null;
  preferences: EpubPreferences;
  onTurn: (direction: "prev" | "next") => void;
  onPreferences: (preferences: EpubPreferences) => void;
  settingsOpen: boolean;
  onSettingsOpen: (open: boolean) => void;
  onActivity: () => void;
}) {
  const previous = (
    <button
      type="button"
      onClick={() => onTurn("prev")}
      aria-label="Previous page"
      className={BUTTON_ROUND}
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
    </button>
  );
  const next = (
    <button
      type="button"
      onClick={() => onTurn("next")}
      aria-label="Next page"
      className={BUTTON_ROUND}
    >
      <ChevronRight aria-hidden="true" className="size-4" />
    </button>
  );
  const settings = (
    <EpubSettings
      preferences={preferences}
      open={settingsOpen}
      onOpenChange={onSettingsOpen}
      onChange={onPreferences}
    />
  );
  const view = (
    <select
      aria-label="Reading view"
      value={preferences.view}
      onChange={(event) =>
        onPreferences({
          ...preferences,
          view: event.target.value as EpubPreferences["view"],
        })
      }
      className={`${SELECT} shrink-0`}
    >
      <option value="paged">Paged</option>
      <option value="scroll">Scroll</option>
    </select>
  );

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated events restart the phone controls idle timer. */}
      <div
        className="reader-bottom-bar order-last flex shrink-0 items-center gap-1 border-t border-separator pt-2 xl:hidden"
        onFocus={onActivity}
        onInput={onActivity}
        onKeyDown={onActivity}
        onPointerDown={onActivity}
      >
        {previous}
        <div className="min-w-0 flex-1 px-1">
          <span className="block truncate text-center text-sm text-secondary">
            {label}
          </span>
          <EpubChapterPercent percent={chapterPercent} />
        </div>
        <EpubBookPercent percent={bookPercent} />
        {settings}
        {next}
      </div>
      <ReaderHeaderTools>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated events restart the phone controls idle timer. */}
        <div
          className="reader-navigation flex min-w-0 items-center gap-1 rounded-xl border border-separator bg-fill p-0.5"
          onFocus={onActivity}
          onInput={onActivity}
          onKeyDown={onActivity}
          onPointerDown={onActivity}
        >
          {previous}
          <span className="flex min-w-0 max-w-52 flex-col px-2 text-center">
            <span
              className="truncate text-sm font-medium text-foreground"
              title={label}
            >
              {label || "Reading"}
            </span>
            <span className="text-xs tabular-nums text-tertiary">
              {bookPercent === null
                ? "Finding your place…"
                : `${bookPercent}% of book`}
            </span>
          </span>
          {next}
        </div>
      </ReaderHeaderTools>
      <ReaderHeaderActions>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated events restart the phone controls idle timer. */}
        <div
          className="reader-utility flex min-w-0 items-center gap-1"
          onFocus={onActivity}
          onInput={onActivity}
          onKeyDown={onActivity}
          onPointerDown={onActivity}
        >
          {view}
          {settings}
        </div>
      </ReaderHeaderActions>
    </>
  );
}
