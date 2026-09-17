import type { PDFDocumentProxy } from "pdfjs-dist";

export type PdfLayout = "spread" | "page" | "scroll";
export type PdfZoom = "auto" | "width" | "page" | number;
export type PdfTint = "paper" | "sepia" | "night";

export type PdfFindSnapshot = {
  current: number;
  total: number;
  pending: boolean;
};

export type PdfSnapshot = {
  document: PDFDocumentProxy;
  page: number;
  pageLabel: string | null;
  pageLabels: string[] | null;
  pages: number;
  scale: number;
  find: PdfFindSnapshot;
};

export type PdfPreferences = {
  layout: PdfLayout;
  zoom: PdfZoom;
  tint: PdfTint;
  contrast: number;
  pageGap: number;
};

export const PDF_LAYOUTS: ReadonlyArray<{
  value: PdfLayout;
  label: string;
}> = [
  { value: "spread", label: "Two pages" },
  { value: "page", label: "One page" },
  { value: "scroll", label: "Scroll" },
];

export const PDF_ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4];

export type PdfTintOption = {
  value: PdfTint;
  label: string;
  filter: string;
  paper: string;
};

export const PDF_TINTS: ReadonlyArray<PdfTintOption> = [
  { value: "paper", label: "Paper", filter: "none", paper: "#ffffff" },
  {
    value: "sepia",
    label: "Sepia",
    filter: "sepia(0.32) saturate(1.1) brightness(0.97)",
    paper: "#f4ecdc",
  },
  {
    value: "night",
    label: "Night",
    filter: "invert(1) hue-rotate(180deg)",
    paper: "#111112",
  },
];

export const DEFAULT_PDF_PREFERENCES: PdfPreferences = {
  layout: "scroll",
  zoom: "auto",
  tint: "paper",
  contrast: 1,
  pageGap: 24,
};
