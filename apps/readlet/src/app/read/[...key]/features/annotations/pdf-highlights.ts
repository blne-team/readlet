import {
  type HighlightMark,
  MAX_MARK_TEXT_LENGTH,
  MAX_PDF_HIGHLIGHT_RECTS,
  MAX_PDF_HIGHLIGHT_SEGMENTS,
  type ReaderMark,
} from "@/domain/reader-marks";
import { highlightPresentation } from "./highlight-colors";
import type { SelectedPassage } from "./selection-menu";

export function selectedPdfText(root: HTMLElement): SelectedPassage | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0)
    return null;
  const range = selection.getRangeAt(0);
  const text = selection.toString().trim().slice(0, MAX_MARK_TEXT_LENGTH);
  if (!text) return null;
  const pages = [
    ...root.querySelectorAll<HTMLElement>(".page[data-page-number]"),
  ]
    .map((element) => ({
      element,
      page: Number(element.dataset.pageNumber),
      bounds: element.getBoundingClientRect(),
    }))
    .filter(
      ({ page, bounds }) =>
        Number.isInteger(page) && bounds.width > 0 && bounds.height > 0,
    );
  const byPage = new Map<number, [number, number, number, number][]>();
  let point: SelectedPassage["point"];
  for (const rect of range.getClientRects()) {
    for (const { page, bounds } of pages) {
      const left = Math.max(rect.left, bounds.left);
      const top = Math.max(rect.top, bounds.top);
      const right = Math.min(rect.right, bounds.right);
      const bottom = Math.min(rect.bottom, bounds.bottom);
      if (right <= left || bottom <= top) continue;
      if (!byPage.has(page) && byPage.size >= MAX_PDF_HIGHLIGHT_SEGMENTS)
        continue;
      const pageRects = byPage.get(page) ?? [];
      if (pageRects.length >= MAX_PDF_HIGHLIGHT_RECTS) continue;
      pageRects.push([
        (left - bounds.left) / bounds.width,
        (top - bounds.top) / bounds.height,
        (right - left) / bounds.width,
        (bottom - top) / bounds.height,
      ]);
      byPage.set(page, pageRects);
      point = { x: right, y: bottom };
    }
  }
  const segments = [...byPage]
    .sort(([left], [right]) => left - right)
    .map(([page, rects]) => ({ page, rects }));
  const first = segments[0];
  if (!first) return null;
  return {
    anchor: { format: "pdf", page: first.page, segments },
    text,
    point,
  };
}

/** PDF.js owns page nodes, so its highlight overlays are added outside React. */
export function mountPdfHighlights(
  root: HTMLElement,
  marks: ReaderMark[],
): () => void {
  const highlights = marks.filter(isPdfHighlight);
  const wanted = new Set(highlights.map((mark) => mark.id));
  const update = () => {
    for (const overlay of root.querySelectorAll<HTMLElement>(
      ".readlet-pdf-highlight[data-mark-id]",
    )) {
      if (!wanted.has(overlay.dataset.markId ?? "")) overlay.remove();
    }
    for (const mark of highlights) {
      if (mark.anchor.format !== "pdf") continue;
      const presentation = highlightPresentation(mark.color);
      for (const segment of mark.anchor.segments) {
        const page = root.querySelector<HTMLElement>(
          `.page[data-page-number="${segment.page}"]`,
        );
        if (!page || page.querySelector(`[data-mark-id="${mark.id}"]`))
          continue;
        const layer = document.createElement("div");
        layer.className = "readlet-pdf-highlight";
        layer.dataset.markId = mark.id;
        Object.assign(layer.style, {
          position: "absolute",
          inset: "0",
          pointerEvents: "none",
          zIndex: "3",
          opacity: `${presentation.opacity}`,
          mixBlendMode: presentation.blendMode,
        });
        for (const [x, y, width, height] of segment.rects) {
          const rect = document.createElement("div");
          Object.assign(rect.style, {
            position: "absolute",
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            width: `${width * 100}%`,
            height: `${height * 100}%`,
            background: presentation.fill,
            borderRadius: "2px",
            cursor: presentation.cursor,
            pointerEvents: "auto",
          });
          layer.appendChild(rect);
        }
        page.appendChild(layer);
      }
    }
  };
  const observer = new MutationObserver(update);
  observer.observe(root, { subtree: true, childList: true });
  update();
  return () => {
    observer.disconnect();
    root.querySelectorAll(".readlet-pdf-highlight").forEach((node) => {
      node.remove();
    });
  };
}

function isPdfHighlight(mark: ReaderMark): mark is HighlightMark {
  return mark.type === "highlight" && mark.anchor.format === "pdf";
}
