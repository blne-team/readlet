"use client";

import type { BookProgress } from "@readlet/core";
import type { Rendition } from "epubjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { EpubControls } from "@/app/read/[...key]/epub-controls";
import { useEpubRuntime } from "@/app/read/[...key]/epub-runtime";
import { type EpubPanel, EpubSidebar } from "@/app/read/[...key]/epub-sidebar";
import {
  type HighlightColor,
  highlightPresentation,
} from "@/app/read/[...key]/features/annotations/highlight-colors";
import {
  type SelectedPassage,
  SelectionMenu,
} from "@/app/read/[...key]/features/annotations/selection-menu";
import {
  DEFAULT_EPUB_PREFERENCES,
  type EpubPreferences,
  epubPreferenceCss,
  epubViewportStyle,
  readEpubPreferences,
  writeEpubPreferences,
} from "@/app/read/[...key]/features/appearance/epub-preferences";
import { EpubProgressBar } from "@/app/read/[...key]/features/progress/epub-progress-chrome";
import { useReadingPosition } from "@/app/read/[...key]/features/progress/position";
import { ReaderMarksContent } from "@/app/read/[...key]/features/reader-marks/reader-marks-content";
import { useReaderMarks } from "@/app/read/[...key]/features/reader-marks/use-reader-marks";
import { ReaderLoading } from "@/app/read/[...key]/reader-loading";
import {
  ReaderHeaderProgress,
  useReaderChrome,
} from "@/app/read/[...key]/reader-shell";
import { ReaderSidebarToggle } from "@/app/read/[...key]/reader-sidebar-tabs";
import { useReaderPanel } from "@/app/read/[...key]/use-reader-panel";
import { MAX_MARK_TEXT_LENGTH, type ReaderMark } from "@/domain/reader-marks";

const MOBILE_CHROME_TIMEOUT_MS = 3500;

export function EpubReader({
  opfUrl,
  bookId,
  title,
  saved,
  canSync,
}: {
  opfUrl: string;
  bookId: string;
  title: string;
  /** This user's position as the library has it, from any device. */
  saved: BookProgress | null;
  /** False against a library the app cannot write to. */
  canSync: boolean;
}) {
  const chrome = useReaderChrome();
  const marks = useReaderMarks(bookId);
  const panel = useReaderPanel<EpubPanel>("contents");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passage, setPassage] = useState<SelectedPassage | null>(null);
  const [compact, setCompact] = useState(false);
  const [chromeActivityAt, setChromeActivityAt] = useState<number | null>(null);
  const selectionOpen = useRef(false);
  const suppressNavigationUntil = useRef(0);
  const selectedWindow = useRef<Window | null>(null);
  const marksWritable = useRef(marks.writable);
  useEffect(() => {
    marksWritable.current = marks.writable;
  }, [marks.writable]);
  const appliedHighlights = useRef<
    Map<string, { cfi: string; color: HighlightColor }>
  >(new Map());
  const [preferences, setPreferences] = useState<EpubPreferences>(
    DEFAULT_EPUB_PREFERENCES,
  );
  const keepChromeVisible = useCallback(
    () => setChromeActivityAt(Date.now()),
    [],
  );
  const toggleChrome = useCallback(() => {
    keepChromeVisible();
    chrome.toggle();
  }, [chrome.toggle, keepChromeVisible]);

  const { current, record } = useReadingPosition({
    bookId,
    saved,
    canSync,
  });

  // Read before the book is rendered, so it is only ever built once, for the
  // layout the reader actually wants.
  const [preferencesRestored, setPreferencesRestored] = useState(false);
  useEffect(() => {
    setPreferences(readEpubPreferences());
    setPreferencesRestored(true);
  }, []);
  const restored = preferencesRestored;
  const { view: readingView, columns } = preferences;
  const preferenceCss = epubPreferenceCss(preferences);
  const { container, rendition, status, progress, toc } = useEpubRuntime({
    opfUrl,
    restored,
    readingView,
    columns,
    preferenceCss,
    current,
    record,
    selectionOpen,
    suppressNavigationUntil,
    onToggleChrome: toggleChrome,
    onSelected: (cfi, contents) => {
      if (!marksWritable.current) return;
      const selection = contents.window?.getSelection();
      const text = selection?.toString().trim().slice(0, MAX_MARK_TEXT_LENGTH);
      if (!text) return;
      const rect = selection?.rangeCount
        ? selection.getRangeAt(0).getBoundingClientRect()
        : null;
      const frame = contents.window?.frameElement?.getBoundingClientRect();
      selectedWindow.current = contents.window ?? null;
      selectionOpen.current = true;
      setPassage({
        anchor: { format: "epub", cfi },
        text,
        point:
          rect && frame
            ? { x: frame.left + rect.left, y: frame.top + rect.bottom }
            : undefined,
      });
      chrome.show();
    },
  });
  const highlightedRendition = useRef<Rendition | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Phone chrome is useful on arrival, then gets out of the way. A tap in the
  // middle of the book brings it back through the rendition interaction
  // handler, and using the controls restarts the quiet period.
  useEffect(() => {
    if (
      !compact ||
      status !== "ready" ||
      !chrome.visible ||
      panel.mobileOpen ||
      settingsOpen ||
      passage
    ) {
      return;
    }
    const quietFor = chromeActivityAt ? Date.now() - chromeActivityAt : 0;
    const timer = window.setTimeout(
      chrome.hide,
      Math.max(MOBILE_CHROME_TIMEOUT_MS - quietFor, 0),
    );
    return () => window.clearTimeout(timer);
  }, [
    compact,
    status,
    chrome.visible,
    chrome.hide,
    chromeActivityAt,
    panel.mobileOpen,
    settingsOpen,
    passage,
  ]);

  useEffect(() => {
    const view = rendition.current;
    if (!view || status !== "ready") return;
    if (highlightedRendition.current !== view) {
      appliedHighlights.current.clear();
      highlightedRendition.current = view;
    }
    const wanted = new Map(
      marks.marks.flatMap((mark) =>
        mark.type === "highlight" && mark.anchor.format === "epub"
          ? [[mark.id, { cfi: mark.anchor.cfi, color: mark.color }] as const]
          : [],
      ),
    );
    for (const [id, item] of appliedHighlights.current) {
      const next = wanted.get(id);
      if (!next || next.cfi !== item.cfi || next.color !== item.color)
        view.annotations.remove(item.cfi, "highlight");
    }
    for (const [id, item] of wanted) {
      const previous = appliedHighlights.current.get(id);
      if (
        !previous ||
        previous.cfi !== item.cfi ||
        previous.color !== item.color
      ) {
        const presentation = highlightPresentation(item.color);
        view.annotations.highlight(item.cfi, { id }, undefined, "epubjs-hl", {
          fill: presentation.fill,
          opacity: `${presentation.opacity}`,
          "mix-blend-mode": presentation.blendMode,
          cursor: presentation.cursor,
          "pointer-events": "all",
        });
      }
    }
    appliedHighlights.current = wanted;
  }, [marks.marks, status, rendition.current]);

  const turn = useCallback(
    (direction: "prev" | "next") => {
      const view = rendition.current;
      if (direction === "prev") view?.prev();
      else view?.next();
    },
    [rendition.current],
  );

  const changePreferences = useCallback((next: EpubPreferences) => {
    writeEpubPreferences(next);
    setPreferences(next);
  }, []);

  const addBookmark = () => {
    const cfi = rendition.current?.location?.start?.cfi;
    if (cfi && marks.writable)
      void marks.createBookmark({ format: "epub", cfi });
  };
  const goToMark = (mark: ReaderMark) => {
    if (mark.anchor.format === "epub")
      void rendition.current?.display(mark.anchor.cfi);
    panel.closeAfterGo();
  };
  const closePassage = () => {
    selectedWindow.current?.getSelection()?.removeAllRanges();
    selectedWindow.current = null;
    selectionOpen.current = false;
    suppressNavigationUntil.current = Date.now() + 700;
    setPassage(null);
  };
  const savePassage = async (color: HighlightColor, note?: string) => {
    if (!passage) return false;
    const savedMark = await marks.createHighlight(
      passage.anchor,
      passage.text,
      color,
      note,
    );
    if (savedMark) closePassage();
    return savedMark;
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      {passage && (
        <SelectionMenu
          passage={passage}
          onSave={savePassage}
          onClose={closePassage}
        />
      )}
      {panel.mobileOpen && (
        <button
          type="button"
          aria-label="Close reader panel"
          onClick={panel.close}
          className="fixed inset-0 z-30 bg-black/20 xl:hidden"
        />
      )}
      <ReaderSidebarToggle
        open={panel.visible}
        desktopOpen={panel.desktopOpen}
        mobileOpen={panel.mobileOpen}
        onToggle={() => {
          panel.toggle(panel.panel);
          chrome.show();
        }}
      />
      <EpubSidebar
        toc={toc}
        panel={panel.panel}
        activeLabel={progress.chapterLabel}
        desktopOpen={panel.desktopOpen}
        mobileOpen={panel.mobileOpen}
        onGo={(href) => {
          void rendition.current?.display(href);
          panel.closeAfterGo();
        }}
        onSelect={panel.open}
        markContent={(mode) => (
          <ReaderMarksContent
            mode={mode}
            bookId={bookId}
            title={title}
            marks={marks.marks.filter((mark) => mark.anchor.format === "epub")}
            error={marks.error}
            writable={marks.writable}
            onBookmark={addBookmark}
            onGo={goToMark}
            onNote={(mark, note) =>
              marks.save({ ...mark, note, updatedAt: new Date().toISOString() })
            }
            onRemove={(id) => {
              void marks.remove(id);
            }}
          />
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {chrome.visible && (
          <ReaderHeaderProgress>
            <EpubProgressBar percent={progress.bookPercent} />
          </ReaderHeaderProgress>
        )}
        <div
          className="epub-reading-surface relative order-2 min-h-0 flex-1"
          data-theme={preferences.theme}
        >
          <div
            ref={container}
            className="absolute mx-auto"
            style={epubViewportStyle(preferences)}
          />
          {status !== "ready" && (
            <div className="absolute inset-0 flex items-center justify-center">
              {status === "error" ? (
                <p className="text-sm text-secondary">
                  This book could not be opened.
                </p>
              ) : (
                <ReaderLoading label="Preparing first chapter…" />
              )}
            </div>
          )}
        </div>

        <div className="order-3 xl:hidden">
          <EpubProgressBar percent={progress.bookPercent} />
        </div>
        {chrome.visible && (
          <EpubControls
            label={progress.chapterLabel}
            bookPercent={progress.bookPercent}
            chapterPercent={progress.chapterPercent}
            preferences={preferences}
            onTurn={turn}
            onPreferences={changePreferences}
            settingsOpen={settingsOpen}
            onSettingsOpen={setSettingsOpen}
            onActivity={keepChromeVisible}
          />
        )}
      </div>
    </div>
  );
}
