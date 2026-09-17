"use client";

import { useEffect, useRef } from "react";
import { selectedPdfText } from "./features/annotations/pdf-highlights";
import type { SelectedPassage } from "./features/annotations/selection-menu";
import { PdfEngine } from "./pdf-engine";
import type {
  PdfLayout,
  PdfPreferences,
  PdfSnapshot,
  PdfTintOption,
} from "./pdf-types";

type TouchGesture = {
  distance: number;
  pinching: boolean;
  startX: number;
  startY: number;
};

const SWIPE_DISTANCE = 60;

function distance(touches: TouchList): number {
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(
    second.clientX - first.clientX,
    second.clientY - first.clientY,
  );
}

function midpoint(touches: TouchList): [number, number] {
  const first = touches[0];
  const second = touches[1];
  return [
    (first.clientX + second.clientX) / 2,
    (first.clientY + second.clientY) / 2,
  ];
}

export function PdfSurface({
  url,
  initialPage,
  initialPreferences,
  layout,
  tint,
  contrast,
  pageGap,
  onEngine,
  onSnapshot,
  onStatus,
  onToggleChrome,
  onOpenSearch,
  onSelectText,
  selectionOpen,
}: {
  url: string;
  initialPage: number;
  initialPreferences: PdfPreferences;
  layout: PdfLayout;
  tint: PdfTintOption;
  contrast: number;
  pageGap: number;
  onEngine: (engine: PdfEngine | null) => void;
  onSnapshot: (snapshot: PdfSnapshot) => void;
  onStatus: (status: "loading" | "ready" | "error") => void;
  onToggleChrome: () => void;
  onOpenSearch: () => void;
  onSelectText: (passage: SelectedPassage) => void;
  selectionOpen: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const engine = useRef<PdfEngine | null>(null);
  const opening = useRef<Promise<void>>(Promise.resolve());
  const initial = useRef({
    page: initialPage,
    preferences: initialPreferences,
  });
  const behavior = useRef({
    layout,
    onToggleChrome,
    selectionOpen,
    onSelectText,
  });
  const suppressNavigationUntil = useRef(0);
  const wasSelectionOpen = useRef(selectionOpen);
  const gesture = useRef<TouchGesture | null>(null);

  useEffect(() => {
    behavior.current = { layout, onToggleChrome, selectionOpen, onSelectText };
    if (wasSelectionOpen.current && !selectionOpen)
      suppressNavigationUntil.current = Date.now() + 700;
    wasSelectionOpen.current = selectionOpen;
  }, [layout, onToggleChrome, selectionOpen, onSelectText]);

  useEffect(() => {
    const containerElement = container.current;
    const viewerElement = viewer.current;
    if (!containerElement || !viewerElement) return;

    let active = true;
    let unsubscribe = () => {};
    onStatus("loading");

    // Effects can be cleaned up and restarted while `create` is awaiting the
    // document. Both PDF.js instances would then own the same viewer element;
    // destroying the first one after the second has appended its pages empties
    // the new reader. Finish (and destroy) the previous opening before allowing
    // another viewer to touch these DOM nodes.
    opening.current = opening.current
      .then(async () => {
        if (!active) return;
        const opened = await PdfEngine.create({
          url,
          elements: { container: containerElement, viewer: viewerElement },
          preferences: initial.current.preferences,
          page: initial.current.page,
        });
        if (!active) {
          opened.destroy();
          return;
        }
        engine.current = opened;
        onEngine(opened);
        onSnapshot(opened.getSnapshot());
        unsubscribe = opened.subscribe(() => onSnapshot(opened.getSnapshot()));
        onStatus("ready");
        opened.focus();
      })
      .catch((error: unknown) => {
        if (active) {
          console.error("The PDF reader could not initialize", error);
          onStatus("error");
        }
      });

    return () => {
      active = false;
      unsubscribe();
      engine.current?.destroy();
      engine.current = null;
      onEngine(null);
    };
  }, [url, onEngine, onSnapshot, onStatus]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let selectionTimer: number | null = null;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || !engine.current) return;
      event.preventDefault();
      engine.current.zoomBy(Math.exp(-event.deltaY / 240), [
        event.clientX,
        event.clientY,
      ]);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        gesture.current = {
          distance: distance(event.touches),
          pinching: true,
          startX: 0,
          startY: 0,
        };
        return;
      }

      const point = event.touches[0];
      gesture.current = point
        ? {
            distance: 0,
            pinching: false,
            startX: point.clientX,
            startY: point.clientY,
          }
        : null;
    };

    const onTouchMove = (event: TouchEvent) => {
      const current = gesture.current;
      if (!current?.pinching || event.touches.length !== 2 || !engine.current) {
        return;
      }
      event.preventDefault();
      const nextDistance = distance(event.touches);
      engine.current.zoomBy(
        nextDistance / current.distance,
        midpoint(event.touches),
      );
      current.distance = nextDistance;
    };

    const onTouchEnd = (event: TouchEvent) => {
      const current = gesture.current;
      gesture.current = null;
      if (window.getSelection() && !window.getSelection()?.isCollapsed) {
        if (selectionTimer !== null) window.clearTimeout(selectionTimer);
        selectionTimer = window.setTimeout(() => {
          const root = viewer.current;
          if (root) {
            const selected = selectedPdfText(root);
            if (selected) behavior.current.onSelectText(selected);
          }
        }, 120);
        return;
      }
      if (
        behavior.current.selectionOpen ||
        Date.now() < suppressNavigationUntil.current ||
        !current ||
        current.pinching ||
        behavior.current.layout === "scroll"
      ) {
        return;
      }

      const point = event.changedTouches[0];
      if (!point || !engine.current) return;
      const movedX = point.clientX - current.startX;
      const movedY = point.clientY - current.startY;
      if (
        Math.abs(movedX) < SWIPE_DISTANCE ||
        Math.abs(movedX) <= Math.abs(movedY) ||
        element.scrollWidth > element.clientWidth + 1
      ) {
        return;
      }
      engine.current.turn(movedX < 0 ? 1 : -1);
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      if (selectionTimer !== null) window.clearTimeout(selectionTimer);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <section
      aria-label="The book"
      className={`pdf-reader relative min-h-0 flex-1 ${
        tint.value === "night" ? "bg-[#0b0b0c]" : "bg-fill"
      }`}
      style={
        {
          "--page-filter": tint.filter,
          "--page-paper": tint.paper,
          "--page-contrast": contrast,
          "--page-margin": `${pageGap / 2}px auto`,
          "--pdfViewer-padding-bottom": `${pageGap / 2}px`,
        } as React.CSSProperties
      }
    >
      {/* The PDF.js container is required to be a div. It is also the reader's
          keyboard target and click surface, so native scrolling, page keys and
          pointer navigation all act on the same viewport. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: PDF.js requires its scroll container to be a div. */}
      <div
        ref={container}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region must be focusable for keyboard scrolling and page commands.
        tabIndex={0}
        className="pdf-viewer-container absolute inset-0 overflow-auto outline-none"
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "f"
          ) {
            event.preventDefault();
            onOpenSearch();
            return;
          }
          if (event.key === "Home" || event.key === "End") {
            engine.current?.goToPage(
              event.key === "Home" ? 1 : Number.MAX_SAFE_INTEGER,
            );
            event.preventDefault();
            return;
          }
          if (behavior.current.layout === "scroll") return;
          const direction =
            event.key === " "
              ? event.shiftKey
                ? -1
                : 1
              : event.key === "ArrowRight" ||
                  event.key === "ArrowDown" ||
                  event.key === "PageDown"
                ? 1
                : event.key === "ArrowLeft" ||
                    event.key === "ArrowUp" ||
                    event.key === "PageUp"
                  ? -1
                  : 0;
          if (direction) {
            engine.current?.turn(direction as 1 | -1);
            event.preventDefault();
          }
        }}
        onClick={(event) => {
          if (
            behavior.current.selectionOpen ||
            Date.now() < suppressNavigationUntil.current
          )
            return;
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) return;
          if (
            event.target instanceof Element &&
            event.target.closest(
              "a, button, input, textarea, select, [role=button]",
            )
          ) {
            return;
          }

          const bounds = event.currentTarget.getBoundingClientRect();
          const position = (event.clientX - bounds.left) / bounds.width;
          if (behavior.current.layout !== "scroll" && position < 0.24) {
            engine.current?.turn(-1);
          } else if (behavior.current.layout !== "scroll" && position > 0.76) {
            engine.current?.turn(1);
          } else {
            behavior.current.onToggleChrome();
          }
        }}
        onMouseUp={() => {
          if (behavior.current.selectionOpen) return;
          const root = viewer.current;
          if (!root) return;
          const selected = selectedPdfText(root);
          if (selected) onSelectText(selected);
        }}
      >
        <div ref={viewer} className="pdfViewer" />
      </div>
    </section>
  );
}
