"use client";

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  List,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeft,
  Plus,
  RotateCw,
  Search,
} from "lucide-react";
import { useState } from "react";
import { BUTTON_ROUND, SELECT } from "@/app/ui";
import { PdfSettings } from "./features/appearance/pdf-settings";
import type { Panel } from "./pdf-sidebar";
import {
  PDF_ZOOM_STEPS,
  type PdfLayout,
  type PdfTint,
  type PdfZoom,
} from "./pdf-types";

export function PdfControls({
  panel,
  page,
  pageLabel,
  pages,
  scale,
  layout,
  effectiveLayout,
  zoom,
  tint,
  contrast,
  pageGap,
  fullscreen,
  onPanel,
  onTurn,
  onGo,
  onLayout,
  onZoom,
  onTint,
  onContrast,
  onPageGap,
  onRotate,
  onFullscreen,
  onBookmark,
  onMarks,
  marksOpen,
  marksWritable,
}: {
  panel: Panel | null;
  page: number;
  pageLabel: string | null;
  pages: number;
  scale: number;
  layout: PdfLayout;
  effectiveLayout: PdfLayout;
  zoom: PdfZoom;
  tint: PdfTint;
  contrast: number;
  pageGap: number;
  fullscreen: boolean;
  onPanel: (panel: Panel) => void;
  onTurn: (direction: 1 | -1) => void;
  onGo: (target: string) => void;
  onLayout: (layout: PdfLayout) => void;
  onZoom: (zoom: PdfZoom) => void;
  onTint: (tint: PdfTint) => void;
  onContrast: (contrast: number) => void;
  onPageGap: (pageGap: number) => void;
  onRotate: () => void;
  onFullscreen: () => void;
  onBookmark: () => void;
  onMarks: () => void;
  marksOpen: boolean;
  marksWritable: boolean;
}) {
  const lastPage =
    effectiveLayout === "spread" && pages % 2 === 1 ? pages - 1 : pages;
  const stepZoom = (direction: 1 | -1) => {
    const next =
      direction === 1
        ? PDF_ZOOM_STEPS.find((value) => value > scale + 0.001)
        : [...PDF_ZOOM_STEPS].reverse().find((value) => value < scale - 0.001);
    if (next !== undefined) onZoom(next);
  };

  return (
    <>
      <div className="reader-bottom-bar flex shrink-0 flex-col gap-1 border-t border-separator bg-background pt-2 xl:hidden">
        <div className="flex items-center justify-center gap-1">
          <Round
            onClick={() => onTurn(-1)}
            label="Previous page"
            disabled={page <= 1}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Round>
          <PageBox
            page={page}
            pageLabel={pageLabel}
            pages={pages}
            onGo={onGo}
          />
          <Round
            onClick={() => onTurn(1)}
            label="Next page"
            disabled={page >= lastPage}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Round>
        </div>

        <div className="flex items-center justify-center gap-1">
          <span className="hidden sm:inline-flex">
            <Toggle
              on={panel === "thumbnails"}
              onClick={() => onPanel("thumbnails")}
              label="Page thumbnails"
            >
              <PanelLeft aria-hidden="true" className="size-4" />
            </Toggle>
          </span>
          <Toggle
            on={panel === "contents"}
            onClick={() => onPanel("contents")}
            label="Contents"
          >
            <List aria-hidden="true" className="size-4" />
          </Toggle>
          <Toggle
            on={panel === "search"}
            onClick={() => onPanel("search")}
            label="Search in this book"
          >
            <Search aria-hidden="true" className="size-4" />
          </Toggle>
          <Round
            onClick={onBookmark}
            label="Bookmark this page"
            disabled={!marksWritable}
          >
            <Bookmark aria-hidden="true" className="size-4" />
          </Round>
          <Toggle
            on={marksOpen}
            onClick={onMarks}
            label="Bookmarks and highlights"
          >
            <Highlighter aria-hidden="true" className="size-4" />
          </Toggle>
          <select
            aria-label="Zoom"
            value={typeof zoom === "number" ? String(zoom) : zoom}
            onChange={(event) => changeZoom(event.target.value, onZoom)}
            className={`${SELECT} hidden shrink-0 sm:block`}
          >
            <ZoomOptions />
          </select>
          <span className="hidden md:inline-flex">
            <Round onClick={onRotate} label="Rotate pages clockwise">
              <RotateCw aria-hidden="true" className="size-4" />
            </Round>
          </span>
          <Round
            onClick={onFullscreen}
            label={fullscreen ? "Leave fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 aria-hidden="true" className="size-4" />
            ) : (
              <Maximize2 aria-hidden="true" className="size-4" />
            )}
          </Round>
          <PdfSettings
            layout={layout}
            tint={tint}
            contrast={contrast}
            pageGap={pageGap}
            onLayout={onLayout}
            onTint={onTint}
            onContrast={onContrast}
            onPageGap={onPageGap}
            onRotate={onRotate}
          />
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-3 border-t border-separator bg-background px-3 py-2.5 xl:flex">
        <div className="flex shrink-0 items-center gap-1">
          <Toggle
            on={panel === "thumbnails"}
            onClick={() => onPanel("thumbnails")}
            label="Page thumbnails"
          >
            <PanelLeft aria-hidden="true" className="size-4" />
          </Toggle>
          <Toggle
            on={panel === "contents"}
            onClick={() => onPanel("contents")}
            label="Contents"
          >
            <List aria-hidden="true" className="size-4" />
          </Toggle>
          <Toggle
            on={panel === "search"}
            onClick={() => onPanel("search")}
            label="Search in this book"
          >
            <Search aria-hidden="true" className="size-4" />
          </Toggle>
          <Round
            onClick={onBookmark}
            label="Bookmark this page"
            disabled={!marksWritable}
          >
            <Bookmark aria-hidden="true" className="size-4" />
          </Round>
          <Toggle
            on={marksOpen}
            onClick={onMarks}
            label="Bookmarks and highlights"
          >
            <Highlighter aria-hidden="true" className="size-4" />
          </Toggle>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Round
            onClick={() => onTurn(-1)}
            label="Previous page"
            disabled={page <= 1}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Round>
          <PageBox
            page={page}
            pageLabel={pageLabel}
            pages={pages}
            onGo={onGo}
          />
          <Round
            onClick={() => onTurn(1)}
            label="Next page"
            disabled={page >= lastPage}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Round>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Round onClick={() => stepZoom(-1)} label="Zoom out">
            <Minus aria-hidden="true" className="size-4" />
          </Round>
          <select
            aria-label="Zoom"
            value={typeof zoom === "number" ? String(zoom) : zoom}
            onChange={(event) => changeZoom(event.target.value, onZoom)}
            className={`${SELECT} shrink-0`}
          >
            <ZoomOptions />
          </select>
          <Round onClick={() => stepZoom(1)} label="Zoom in">
            <Plus aria-hidden="true" className="size-4" />
          </Round>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Round onClick={onRotate} label="Rotate pages clockwise">
            <RotateCw aria-hidden="true" className="size-4" />
          </Round>
          <Round
            onClick={onFullscreen}
            label={fullscreen ? "Leave fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 aria-hidden="true" className="size-4" />
            ) : (
              <Maximize2 aria-hidden="true" className="size-4" />
            )}
          </Round>
          <PdfSettings
            layout={layout}
            tint={tint}
            contrast={contrast}
            pageGap={pageGap}
            onLayout={onLayout}
            onTint={onTint}
            onContrast={onContrast}
            onPageGap={onPageGap}
            onRotate={onRotate}
          />
        </div>
      </div>
    </>
  );
}

function changeZoom(value: string, onZoom: (zoom: PdfZoom) => void) {
  onZoom(
    value === "auto" || value === "width" || value === "page"
      ? value
      : Number(value),
  );
}

function ZoomOptions() {
  return (
    <>
      <option value="auto">Automatic</option>
      <option value="width">Fit width</option>
      <option value="page">Fit page</option>
      {PDF_ZOOM_STEPS.map((value) => (
        <option key={value} value={value}>
          {Math.round(value * 100)}%
        </option>
      ))}
    </>
  );
}

function Round({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={BUTTON_ROUND}
    >
      {children}
    </button>
  );
}

function Toggle({
  on,
  onClick,
  label,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors ${
        on
          ? "bg-accent text-white hover:bg-accent-hover"
          : "bg-fill hover:bg-fill-hover"
      }`}
    >
      {children}
    </button>
  );
}

function PageBox({
  page,
  pageLabel,
  pages,
  onGo,
}: {
  page: number;
  pageLabel: string | null;
  pages: number;
  onGo: (target: string) => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const shown = pageLabel ?? String(page);

  const commit = () => {
    const target = typed?.trim();
    setTyped(null);
    if (target) onGo(target);
  };

  return (
    <span className="flex items-center gap-1 text-sm tabular-nums text-secondary">
      <input
        type="text"
        aria-label="Page"
        value={typed ?? shown}
        onChange={(event) => setTyped(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            commit();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setTyped(null);
            event.currentTarget.blur();
          }
        }}
        className="h-11 w-14 rounded-lg bg-fill px-2 py-2 text-center text-sm tabular-nums outline-none transition-shadow focus:ring-2 focus:ring-accent"
      />
      <span className="shrink-0 text-tertiary">of {pages || "…"}</span>
    </span>
  );
}
