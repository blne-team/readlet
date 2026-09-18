"use client";

import { RotateCw, Settings2, X } from "lucide-react";
import { useEffect } from "react";
import { BUTTON, BUTTON_ROUND, SELECT } from "@/app/ui";
import {
  PDF_LAYOUTS,
  PDF_TINTS,
  type PdfLayout,
  type PdfTint,
} from "../../pdf-types";

export function PdfSettings({
  open,
  onOpenChange,
  layout,
  tint,
  contrast,
  pageGap,
  onLayout,
  onTint,
  onContrast,
  onPageGap,
  onRotate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: PdfLayout;
  tint: PdfTint;
  contrast: number;
  pageGap: number;
  onLayout: (layout: PdfLayout) => void;
  onTint: (tint: PdfTint) => void;
  onContrast: (contrast: number) => void;
  onPageGap: (pageGap: number) => void;
  onRotate: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onOpenChange]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="PDF view settings"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={BUTTON_ROUND}
      >
        <Settings2 aria-hidden="true" className="size-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close PDF view settings"
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-20 bg-black/15 xl:bg-transparent"
          />
          <section
            role="dialog"
            aria-label="PDF view settings"
            className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-separator bg-surface p-4 shadow-page xl:absolute xl:inset-x-auto xl:top-full xl:right-0 xl:bottom-auto xl:mt-3 xl:w-72"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">PDF view</h2>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => onOpenChange(false)}
                className="inline-flex size-11 items-center justify-center rounded-full text-secondary transition-colors hover:bg-fill hover:text-foreground xl:hidden"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Layout
                <select
                  value={layout}
                  onChange={(event) =>
                    onLayout(event.target.value as PdfLayout)
                  }
                  className={`${SELECT} w-full text-foreground`}
                >
                  {PDF_LAYOUTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Page appearance
                <select
                  value={tint}
                  onChange={(event) => onTint(event.target.value as PdfTint)}
                  className={`${SELECT} w-full text-foreground`}
                >
                  {PDF_TINTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <Range
                label="Contrast"
                value={contrast}
                min={0.5}
                max={3}
                step={0.1}
                shown={`${Math.round(contrast * 100)}%`}
                onChange={onContrast}
              />
              <Range
                label="Space between pages"
                value={pageGap}
                min={0}
                max={48}
                step={4}
                shown={`${pageGap}px`}
                onChange={onPageGap}
              />
              <button
                type="button"
                onClick={onRotate}
                className={`${BUTTON} w-full gap-2 xl:hidden`}
              >
                <RotateCw aria-hidden="true" className="size-4" />
                Rotate pages
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  shown,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shown: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-secondary">
      <span className="flex items-center justify-between gap-3">
        {label}
        <span className="font-normal tabular-nums text-tertiary">{shown}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}
