"use client";

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RotateCw,
} from "lucide-react";
import { useState } from "react";
import { BUTTON_ROUND, SELECT } from "@/app/ui";
import { PdfSettings } from "./features/appearance/pdf-settings";
import {
  PDF_ZOOM_STEPS,
  type PdfLayout,
  type PdfTint,
  type PdfZoom,
} from "./pdf-types";
import { ReaderHeaderActions, ReaderHeaderTools } from "./reader-shell";

export function PdfControls({
  page,
  pageLabel,
  pages,
  layout,
  effectiveLayout,
  zoom,
  tint,
  contrast,
  pageGap,
  fullscreen,
  onTurn,
  onGo,
  onLayout,
  onZoom,
  onTint,
  onContrast,
  onPageGap,
  onRotate,
  onFullscreen,
  settingsOpen,
  onSettingsOpen,
  onActivity,
}: {
  page: number;
  pageLabel: string | null;
  pages: number;
  layout: PdfLayout;
  effectiveLayout: PdfLayout;
  zoom: PdfZoom;
  tint: PdfTint;
  contrast: number;
  pageGap: number;
  fullscreen: boolean;
  onTurn: (direction: 1 | -1) => void;
  onGo: (target: string) => void;
  onLayout: (layout: PdfLayout) => void;
  onZoom: (zoom: PdfZoom) => void;
  onTint: (tint: PdfTint) => void;
  onContrast: (contrast: number) => void;
  onPageGap: (pageGap: number) => void;
  onRotate: () => void;
  onFullscreen: () => void;
  settingsOpen: boolean;
  onSettingsOpen: (open: boolean) => void;
  onActivity: () => void;
}) {
  const lastPage =
    effectiveLayout === "spread" && pages % 2 === 1 ? pages - 1 : pages;
  const previous = (
    <Round
      onClick={() => onTurn(-1)}
      label="Previous page"
      disabled={page <= 1}
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
    </Round>
  );
  const next = (
    <Round
      onClick={() => onTurn(1)}
      label="Next page"
      disabled={page >= lastPage}
    >
      <ChevronRight aria-hidden="true" className="size-4" />
    </Round>
  );
  const fullscreenButton = (
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
  );
  const settings = (
    <PdfSettings
      open={settingsOpen}
      onOpenChange={onSettingsOpen}
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
  );
  const zoomSelect = (
    <select
      aria-label="Zoom"
      value={typeof zoom === "number" ? String(zoom) : zoom}
      onChange={(event) => changeZoom(event.target.value, onZoom)}
      className={`${SELECT} shrink-0`}
    >
      <ZoomOptions />
    </select>
  );

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated events restart the phone controls idle timer. */}
      <div
        className="reader-bottom-bar order-last flex shrink-0 items-center justify-center gap-1 border-t border-separator pt-2 xl:hidden"
        onFocus={onActivity}
        onInput={onActivity}
        onKeyDown={onActivity}
        onPointerDown={onActivity}
      >
        {previous}
        <PageBox page={page} pageLabel={pageLabel} pages={pages} onGo={onGo} />
        {next}
        <span className="hidden sm:inline-flex">{zoomSelect}</span>
        <span className="hidden sm:inline-flex">{fullscreenButton}</span>
        {settings}
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
          <PageBox
            page={page}
            pageLabel={pageLabel}
            pages={pages}
            onGo={onGo}
          />
          {next}
        </div>
      </ReaderHeaderTools>
      <ReaderHeaderActions>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated events restart the phone controls idle timer. */}
        <div
          className="reader-utility flex min-w-0 items-center gap-0.5"
          onFocus={onActivity}
          onInput={onActivity}
          onKeyDown={onActivity}
          onPointerDown={onActivity}
        >
          {zoomSelect}
          <span className="mx-1.5 h-5 w-px bg-separator" aria-hidden="true" />
          <Round onClick={onRotate} label="Rotate pages clockwise">
            <RotateCw aria-hidden="true" className="size-4" />
          </Round>
          {fullscreenButton}
          {settings}
        </div>
      </ReaderHeaderActions>
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
        className="h-10 w-14 rounded-lg bg-fill px-2 py-2 text-center text-sm font-medium tabular-nums text-foreground outline-none transition-shadow focus:ring-2 focus:ring-accent xl:bg-background/80"
      />
      <span className="shrink-0 text-tertiary">of {pages || "…"}</span>
    </span>
  );
}
