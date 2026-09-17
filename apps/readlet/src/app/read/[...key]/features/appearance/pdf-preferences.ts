"use client";

import { readStored, writeStored } from "@/lib/local";
import {
  DEFAULT_PDF_PREFERENCES,
  PDF_ZOOM_STEPS,
  type PdfLayout,
  type PdfPreferences,
  type PdfTint,
  type PdfZoom,
} from "../../pdf-types";

const KEYS = {
  layout: "readlet:pdf:layout",
  zoom: "readlet:pdf:zoom",
  tint: "readlet:pdf:tint",
  contrast: "readlet:pdf:contrast",
  pageGap: "readlet:pdf:page-gap",
} as const;

const LAYOUTS = new Set<PdfLayout>(["spread", "page", "scroll"]);
const TINTS = new Set<PdfTint>(["paper", "sepia", "night"]);
const FIT_ZOOMS = new Set<PdfZoom>(["auto", "width", "page"]);

export function readPdfPreferences(): PdfPreferences {
  const storedLayout = readStored(KEYS.layout) as PdfLayout | null;
  const storedTint = readStored(KEYS.tint) as PdfTint | null;
  const storedZoom = readStored(KEYS.zoom);
  const storedContrast = Number(readStored(KEYS.contrast));
  const storedPageGap = Number(readStored(KEYS.pageGap));

  let zoom = DEFAULT_PDF_PREFERENCES.zoom;
  if (storedZoom && FIT_ZOOMS.has(storedZoom as PdfZoom)) {
    zoom = storedZoom as PdfZoom;
  } else {
    const numeric = Number(storedZoom);
    if (PDF_ZOOM_STEPS.includes(numeric)) zoom = numeric;
  }

  return {
    layout:
      storedLayout && LAYOUTS.has(storedLayout)
        ? storedLayout
        : DEFAULT_PDF_PREFERENCES.layout,
    zoom,
    tint:
      storedTint && TINTS.has(storedTint)
        ? storedTint
        : DEFAULT_PDF_PREFERENCES.tint,
    contrast:
      Number.isFinite(storedContrast) &&
      storedContrast >= 0.5 &&
      storedContrast <= 3
        ? storedContrast
        : DEFAULT_PDF_PREFERENCES.contrast,
    pageGap:
      Number.isFinite(storedPageGap) &&
      storedPageGap >= 0 &&
      storedPageGap <= 48
        ? storedPageGap
        : DEFAULT_PDF_PREFERENCES.pageGap,
  };
}

export function writePdfPreference<K extends keyof PdfPreferences>(
  key: K,
  value: PdfPreferences[K],
): void {
  writeStored(KEYS[key], String(value));
}
