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
import { ReaderMarksPanel } from "./features/reader-marks/reader-marks-panel";
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
import { useReaderChrome } from "./reader-shell";

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
  const [marksOpen, setMarksOpen] = useState(false);
  const [passage, setPassage] = useState<SelectedPassage | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const surfaceFrame = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<PdfEngine | null>(null);
  const [snapshot, setSnapshot] = useState<PdfSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [preferences, setPreferences] = useState<PdfPreferences | null>(null);
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [surfaceWidth, setSurfaceWidth] = useState(0);

  const position = useReadingPosition({
    bookId,
    saved,
    canSync,
  });
  const pdfDocument = snapshot?.document ?? null;
  const currentPage = snapshot?.page;

  useEffect(() => setPreferences(readPdfPreferences()), []);

  const preferencesReady = preferences !== null;
  useEffect(() => {
    if (!preferencesReady || !surfaceFrame.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSurfaceWidth(entry.contentRect.width),
    );
    observer.observe(surfaceFrame.current);
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
    if (!pdfDocument) return;
    let active = true;
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
    if (!fullscreen || !chrome.visible || panel) return;
    const timer = window.setTimeout(chrome.hide, FULLSCREEN_CHROME_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [fullscreen, chrome.visible, chrome.hide, panel]);

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
    setPanel("search");
    chrome.show();
  }, [chrome.show]);

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
  const togglePanel = (next: Panel) => {
    setPanel((current) => (current === next ? null : next));
    chrome.show();
  };
  const goFromPanel = (target: number) => {
    engine?.goToPage(target);
    if (window.innerWidth < 1280) setPanel(null);
  };
  const openOutlineFromPanel = (entry: OutlineEntry) => {
    if (entry.destination) engine?.goToDestination(entry.destination);
    else if (entry.page) engine?.goToPage(entry.page);
    if (window.innerWidth < 1280) setPanel(null);
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
    setMarksOpen(false);
  };

  return (
    <div ref={root} className="relative flex min-h-0 flex-1 bg-background">
      {passage && (
        <SelectionMenu
          passage={passage}
          onSave={savePassage}
          onClose={closePassage}
        />
      )}
      {marksOpen && (
        <>
          <button
            type="button"
            aria-label="Close marks"
            onClick={() => setMarksOpen(false)}
            className="fixed inset-0 z-30 bg-black/20"
          />
          <ReaderMarksPanel
            bookId={bookId}
            title={title}
            marks={marks.marks.filter((mark) => mark.anchor.format === "pdf")}
            error={marks.error}
            writable={marks.writable}
            onGo={goToMark}
            onNote={(mark, note) => {
              void marks.save({ ...mark, note });
            }}
            onRemove={(id) => {
              void marks.remove(id);
            }}
            onClose={() => setMarksOpen(false)}
          />
        </>
      )}
      {panel && snapshot && (
        <>
          <button
            type="button"
            aria-label="Close side panel"
            onClick={() => setPanel(null)}
            className="fixed inset-0 z-30 bg-black/20 xl:hidden"
          />
          <PdfSidebar
            panel={panel}
            document={snapshot.document}
            labels={snapshot.pageLabels}
            outline={outline}
            page={page}
            search={search}
            find={snapshot.find}
            onGo={goFromPanel}
            onOpenOutline={openOutlineFromPanel}
            onFindAgain={(previous) => engine?.findAgain(previous)}
            onClose={() => setPanel(null)}
          />
        </>
      )}

      <div ref={surfaceFrame} className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1">
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
            onToggleChrome={chrome.toggle}
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

        <div className="h-px w-full bg-separator">
          <div
            className="h-px bg-accent transition-[width] duration-200"
            style={{ width: pages ? `${(page / pages) * 100}%` : 0 }}
          />
        </div>

        {chrome.visible && (
          <PdfControls
            panel={panel}
            page={page}
            pageLabel={snapshot?.pageLabel ?? null}
            pages={pages}
            scale={snapshot?.scale ?? 1}
            layout={preferences.layout}
            effectiveLayout={effectiveLayout}
            zoom={preferences.zoom}
            tint={preferences.tint}
            contrast={preferences.contrast}
            pageGap={preferences.pageGap}
            fullscreen={fullscreen}
            onPanel={togglePanel}
            onTurn={(direction) => engine?.turn(direction)}
            onGo={(target) => engine?.goToPage(target)}
            onLayout={changeLayout}
            onZoom={changeZoom}
            onTint={changeTint}
            onContrast={changeContrast}
            onPageGap={changePageGap}
            onRotate={() => engine?.rotate()}
            onFullscreen={toggleFullscreen}
            onBookmark={() => {
              if (marks.writable)
                void marks.createBookmark({ format: "pdf", page });
            }}
            onMarks={() => setMarksOpen((current) => !current)}
            marksOpen={marksOpen}
            marksWritable={marks.writable}
          />
        )}
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
