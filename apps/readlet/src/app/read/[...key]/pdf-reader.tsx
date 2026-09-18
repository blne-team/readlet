"use client";

import type { BookProgress } from "@readlet/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReaderMark } from "@/domain/reader-marks";
import type { HighlightColor } from "./features/annotations/highlight-colors";
import { mountPdfHighlights } from "./features/annotations/pdf-highlights";
import {
  type SelectedPassage,
  SelectionMenu,
} from "./features/annotations/selection-menu";
import {
  readPdfPreferences,
  writePdfPreference,
} from "./features/appearance/pdf-preferences";
import { useReadingPosition } from "./features/progress/position";
import { ReaderMarksContent } from "./features/reader-marks/reader-marks-content";
import { useReaderMarks } from "./features/reader-marks/use-reader-marks";
import { usePdfSearch } from "./features/search/pdf-search";
import { PdfControls } from "./pdf-controls";
import { type OutlineEntry, readOutline } from "./pdf-document";
import type { PdfEngine } from "./pdf-engine";
import { type Panel, PdfSidebar } from "./pdf-sidebar";
import { PdfSurface } from "./pdf-surface";
import {
  PDF_TINTS,
  type PdfLayout,
  type PdfPreferences,
  type PdfSnapshot,
  type PdfTint,
  type PdfZoom,
} from "./pdf-types";
import { ReaderLoading } from "./reader-loading";
import { ReaderHeaderProgress, useReaderChrome } from "./reader-shell";
import { ReaderSidebarToggle } from "./reader-sidebar-tabs";
import { useReaderPanel } from "./use-reader-panel";

const FULLSCREEN_CHROME_TIMEOUT_MS = 3500;
const MIN_SPREAD_WIDTH = 800;

export function PdfReader({
  url,
  bookId,
  title,
  saved,
  canSync,
}: {
  url: string;
  bookId: string;
  title: string;
  saved: BookProgress | null;
  canSync: boolean;
}) {
  const chrome = useReaderChrome();
  const marks = useReaderMarks(bookId);
  const panel = useReaderPanel<Panel>("contents");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [chromeActivityAt, setChromeActivityAt] = useState<number | null>(null);
  const [passage, setPassage] = useState<SelectedPassage | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const surfaceArea = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<PdfEngine | null>(null);
  const [snapshot, setSnapshot] = useState<PdfSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [preferences, setPreferences] = useState<PdfPreferences | null>(null);
  const [outline, setOutline] = useState<OutlineEntry[] | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [surfaceWidth, setSurfaceWidth] = useState(0);
  const [surfaceHeight, setSurfaceHeight] = useState(0);

  const position = useReadingPosition({
    bookId,
    saved,
    canSync,
  });
  const pdfDocument = snapshot?.document ?? null;
  const currentPage = snapshot?.page;

  useEffect(() => setPreferences(readPdfPreferences()), []);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => {
      setCompact(query.matches);
      if (!query.matches) chrome.show();
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [chrome.show]);

  const keepChromeVisible = useCallback(
    () => setChromeActivityAt(Date.now()),
    [],
  );
  const toggleChrome = useCallback(() => {
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    keepChromeVisible();
    chrome.toggle();
  }, [chrome.toggle, keepChromeVisible]);

  const preferencesReady = preferences !== null;
  useEffect(() => {
    if (!preferencesReady || !surfaceArea.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSurfaceWidth(entry.contentRect.width);
      setSurfaceHeight(entry.contentRect.height);
    });
    observer.observe(surfaceArea.current);
    return () => observer.disconnect();
  }, [preferencesReady]);

  const preferredLayout = preferences?.layout ?? "page";
  const effectiveLayout =
    preferredLayout === "spread" && surfaceWidth < MIN_SPREAD_WIDTH
      ? "page"
      : preferredLayout;

  useEffect(() => {
    engine?.setLayout(effectiveLayout);
  }, [engine, effectiveLayout]);

  useEffect(() => {
    // A docked sidebar changes the space available to a fitted PDF page.
    if (
      engine &&
      surfaceWidth > 0 &&
      surfaceHeight > 0 &&
      typeof preferences?.zoom === "string"
    ) {
      engine.setZoom(preferences.zoom);
    }
  }, [engine, surfaceWidth, surfaceHeight, preferences?.zoom]);

  useEffect(() => {
    if (!pdfDocument) return;
    let active = true;
    setOutline(null);
    void readOutline(pdfDocument).then((entries) => {
      if (active) setOutline(entries);
    });
    return () => {
      active = false;
    };
  }, [pdfDocument]);

  const search = usePdfSearch(pdfDocument, snapshot?.pages ?? 0);

  useEffect(() => {
    engine?.find(search.activeQuery);
  }, [engine, search.activeQuery]);

  useEffect(() => {
    if (!engine) return;
    return mountPdfHighlights(engine.container, marks.marks);
  }, [engine, marks.marks]);

  const started = useRef(false);
  useEffect(() => {
    if (!currentPage || status !== "ready") return;
    if (!started.current) {
      started.current = true;
      return;
    }
    position.record({ page: currentPage });
  }, [currentPage, status, position.record]);

  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  useEffect(() => {
    if (
      !compact ||
      status !== "ready" ||
      !chrome.visible ||
      panel.mobileOpen ||
      settingsOpen ||
      passage
    )
      return;
    const quietFor = chromeActivityAt ? Date.now() - chromeActivityAt : 0;
    const timer = window.setTimeout(
      chrome.hide,
      Math.max(FULLSCREEN_CHROME_TIMEOUT_MS - quietFor, 0),
    );
    return () => window.clearTimeout(timer);
  }, [
    compact,
    status,
    chrome.visible,
    chrome.hide,
    panel.mobileOpen,
    settingsOpen,
    passage,
    chromeActivityAt,
  ]);

  const onEngine = useCallback((value: PdfEngine | null) => {
    setEngine(value);
    if (!value) setSnapshot(null);
  }, []);
  const onSnapshot = useCallback(
    (value: PdfSnapshot) => setSnapshot(value),
    [],
  );
  const onStatus = useCallback(
    (value: "loading" | "ready" | "error") => setStatus(value),
    [],
  );
  const openSearch = useCallback(() => {
    panel.open("search");
    chrome.show();
  }, [chrome.show, panel.open]);

  if (!preferences) {
    return <Loading />;
  }

  const initialPage = position.current()?.page ?? 1;
  const page = snapshot?.page ?? initialPage;
  const pages = snapshot?.pages ?? 0;
  const tint =
    PDF_TINTS.find((option) => option.value === preferences.tint) ??
    PDF_TINTS[0];

  const changeLayout = (layout: PdfLayout) => {
    writePdfPreference("layout", layout);
    setPreferences((current) => (current ? { ...current, layout } : current));
    engine?.setLayout(
      layout === "spread" && surfaceWidth < MIN_SPREAD_WIDTH ? "page" : layout,
    );
  };
  const changeZoom = (zoom: PdfZoom) => {
    writePdfPreference("zoom", zoom);
    setPreferences((current) => (current ? { ...current, zoom } : current));
    engine?.setZoom(zoom);
  };
  const changeTint = (value: PdfTint) => {
    writePdfPreference("tint", value);
    setPreferences((current) =>
      current ? { ...current, tint: value } : current,
    );
  };
  const changeContrast = (contrast: number) => {
    writePdfPreference("contrast", contrast);
    setPreferences((current) => (current ? { ...current, contrast } : current));
  };
  const changePageGap = (pageGap: number) => {
    writePdfPreference("pageGap", pageGap);
    setPreferences((current) => (current ? { ...current, pageGap } : current));
  };
  const togglePanel = () => {
    panel.toggle(panel.panel);
    chrome.show();
  };
  const goFromPanel = (target: number) => {
    engine?.goToPage(target);
    panel.closeAfterGo();
  };
  const openOutlineFromPanel = (entry: OutlineEntry) => {
    if (entry.destination) engine?.goToDestination(entry.destination);
    else if (entry.page) engine?.goToPage(entry.page);
    panel.closeAfterGo();
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement === root.current) {
      void document.exitFullscreen();
    } else if (root.current) {
      void root.current.requestFullscreen();
    }
  };
  const selectText = (selected: SelectedPassage) => {
    if (!marks.writable) return;
    setPassage(selected);
    chrome.show();
  };
  const closePassage = () => {
    window.getSelection()?.removeAllRanges();
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
  const goToMark = (mark: ReaderMark) => {
    if (mark.anchor.format === "pdf") engine?.goToPage(mark.anchor.page);
    panel.closeAfterGo();
  };

  return (
    <div
      ref={root}
      className="relative flex min-h-0 min-w-0 flex-1 bg-background"
    >
      {passage && (
        <SelectionMenu
          passage={passage}
          onSave={savePassage}
          onClose={closePassage}
        />
      )}
      {snapshot && (
        <>
          {panel.mobileOpen && (
            <button
              type="button"
              aria-label="Close side panel"
              onClick={panel.close}
              className="fixed inset-0 z-30 bg-black/20 xl:hidden"
            />
          )}
          <ReaderSidebarToggle
            open={panel.visible}
            desktopOpen={panel.desktopOpen}
            mobileOpen={panel.mobileOpen}
            onToggle={togglePanel}
          />
          <PdfSidebar
            panel={panel.panel}
            document={snapshot.document}
            labels={snapshot.pageLabels}
            outline={outline}
            page={page}
            search={search}
            find={snapshot.find}
            onGo={goFromPanel}
            onOpenOutline={openOutlineFromPanel}
            onFindAgain={(previous) => engine?.findAgain(previous)}
            onSelect={panel.open}
            markContent={(mode) => (
              <ReaderMarksContent
                mode={mode}
                bookId={bookId}
                title={title}
                marks={marks.marks.filter(
                  (mark) => mark.anchor.format === "pdf",
                )}
                error={marks.error}
                writable={marks.writable}
                onBookmark={() => {
                  if (marks.writable)
                    void marks.createBookmark({ format: "pdf", page });
                }}
                onGo={goToMark}
                onNote={(mark, note) =>
                  marks.save({
                    ...mark,
                    note,
                    updatedAt: new Date().toISOString(),
                  })
                }
                onRemove={(id) => {
                  void marks.remove(id);
                }}
              />
            )}
            desktopOpen={panel.desktopOpen}
            mobileOpen={panel.mobileOpen}
          />
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {chrome.visible && (
          <ReaderHeaderProgress>
            <PdfProgress page={page} pages={pages} />
          </ReaderHeaderProgress>
        )}
        {chrome.visible && (
          <PdfControls
            page={page}
            pageLabel={snapshot?.pageLabel ?? null}
            pages={pages}
            layout={preferences.layout}
            effectiveLayout={effectiveLayout}
            zoom={preferences.zoom}
            tint={preferences.tint}
            contrast={preferences.contrast}
            pageGap={preferences.pageGap}
            fullscreen={fullscreen}
            onTurn={(direction) => engine?.turn(direction)}
            onGo={(target) => engine?.goToPage(target)}
            onLayout={changeLayout}
            onZoom={changeZoom}
            onTint={changeTint}
            onContrast={changeContrast}
            onPageGap={changePageGap}
            onRotate={() => engine?.rotate()}
            onFullscreen={toggleFullscreen}
            settingsOpen={settingsOpen}
            onSettingsOpen={setSettingsOpen}
            onActivity={keepChromeVisible}
          />
        )}
        <div ref={surfaceArea} className="relative order-2 flex min-h-0 flex-1">
          <PdfSurface
            url={url}
            initialPage={initialPage}
            initialPreferences={{ ...preferences, layout: effectiveLayout }}
            layout={effectiveLayout}
            tint={tint}
            contrast={preferences.contrast}
            pageGap={preferences.pageGap}
            onEngine={onEngine}
            onSnapshot={onSnapshot}
            onStatus={onStatus}
            onToggleChrome={toggleChrome}
            onOpenSearch={openSearch}
            onSelectText={selectText}
            selectionOpen={passage !== null}
          />

          {status !== "ready" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              {status === "error" ? (
                <p className="text-sm text-secondary">
                  This book could not be opened.
                </p>
              ) : (
                <ReaderLoading label="Preparing first page…" />
              )}
            </div>
          )}
        </div>

        <div className="order-3 xl:hidden">
          <PdfProgress page={page} pages={pages} />
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-fill">
      <ReaderLoading label="Preparing first page…" />
    </div>
  );
}

function PdfProgress({ page, pages }: { page: number; pages: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Book progress"
      aria-valuemin={0}
      aria-valuemax={pages || undefined}
      aria-valuenow={pages ? page : undefined}
      className="h-1 w-full bg-separator"
    >
      <div
        className="h-full bg-accent transition-[width] duration-200"
        style={{ width: pages ? `${(page / pages) * 100}%` : 0 }}
      />
    </div>
  );
}
