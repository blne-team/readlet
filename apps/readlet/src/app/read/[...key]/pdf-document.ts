"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfCore, PDFJS_ASSETS } from "./pdf-runtime";

/** Balance network round trips against unused bytes on an initial open. */
const RANGE_CHUNK_SIZE = 1 << 17;

export type Opened = {
  doc: PDFDocumentProxy;
  close: () => void;
};

/** Opens one ranged document and retains the loading task that owns its worker. */
export async function openPdf(url: string): Promise<Opened> {
  const { getDocument } = await loadPdfCore();
  const task = getDocument({
    url,
    cMapUrl: `${PDFJS_ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ASSETS}standard_fonts/`,
    wasmUrl: `${PDFJS_ASSETS}wasm/`,
    iccUrl: `${PDFJS_ASSETS}iccs/`,
    rangeChunkSize: RANGE_CHUNK_SIZE,
    disableAutoFetch: true,
    disableStream: true,
    enableXfa: false,
  });

  try {
    return { doc: await task.promise, close: () => void task.destroy() };
  } catch (error) {
    await task.destroy();
    throw error;
  }
}

export type PdfDestination = string | unknown[];

export type OutlineEntry = {
  id: number;
  title: string;
  depth: number;
  page: number | null;
  destination: PdfDestination | null;
};

type RawOutline = Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>;

async function destinationPage(
  doc: PDFDocumentProxy,
  destination: PdfDestination | null,
): Promise<number | null> {
  if (!destination) return null;
  try {
    const explicit =
      typeof destination === "string"
        ? await doc.getDestination(destination)
        : destination;
    if (!explicit?.length) return null;

    const target = explicit[0];
    if (typeof target === "number") return target + 1;
    if (typeof target !== "object" || target === null) return null;
    return (await doc.getPageIndex(target as never)) + 1;
  } catch {
    return null;
  }
}

/** Resolves the PDF outline once while retaining each exact destination. */
export async function readOutline(
  doc: PDFDocumentProxy,
): Promise<OutlineEntry[]> {
  const outline = await doc.getOutline().catch(() => null);
  if (!outline?.length) return [];

  const flat: Array<{
    title: string;
    depth: number;
    destination: PdfDestination | null;
  }> = [];
  const walk = (items: RawOutline, depth: number) => {
    for (const item of items) {
      flat.push({
        title: item.title.trim(),
        depth,
        destination: item.dest as PdfDestination | null,
      });
      if (item.items.length) walk(item.items, depth + 1);
    }
  };
  walk(outline, 0);

  const pages = await Promise.all(
    flat.map(({ destination }) => destinationPage(doc, destination)),
  );
  return flat
    .map((entry, index) => ({
      ...entry,
      id: index,
      page: pages[index] ?? null,
    }))
    .filter(({ title }) => title.length > 0);
}
