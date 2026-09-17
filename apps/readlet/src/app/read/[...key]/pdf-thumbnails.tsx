"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

const THUMBNAIL_WIDTH = 132;
const MAX_THUMBNAIL_DENSITY = 1.5;

export function PdfThumbnails({
  document,
  page,
  labels,
  onGo,
}: {
  document: PDFDocumentProxy;
  page: number;
  labels: string[] | null;
  onGo: (page: number) => void;
}) {
  return (
    <ol className="space-y-2 px-3 py-2">
      {Array.from({ length: document.numPages }, (_, index) => {
        const number = index + 1;
        return (
          <li key={number}>
            <button
              type="button"
              onClick={() => onGo(number)}
              aria-current={number === page ? "page" : undefined}
              className={`group flex w-full flex-col items-center gap-1.5 rounded-lg px-2 py-2 transition-colors hover:bg-fill ${
                number === page ? "bg-fill text-accent" : "text-secondary"
              }`}
            >
              <Thumbnail document={document} page={number} />
              <span className="text-xs tabular-nums">
                {labels?.[index] ?? number}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Thumbnail({
  document,
  page,
}: {
  document: PDFDocumentProxy;
  page: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [nearby, setNearby] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setNearby(entry.isIntersecting);
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearby) return;
    let active = true;
    let renderTask: ReturnType<
      Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]
    > | null = null;

    void document
      .getPage(page)
      .then((pdfPage) => {
        if (!active || !canvas.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const density = Math.min(
          window.devicePixelRatio || 1,
          MAX_THUMBNAIL_DENSITY,
        );
        const scale = (THUMBNAIL_WIDTH / base.width) * density;
        const viewport = pdfPage.getViewport({ scale });
        const target = canvas.current;
        target.width = Math.round(viewport.width);
        target.height = Math.round(viewport.height);
        target.style.width = `${THUMBNAIL_WIDTH}px`;
        target.style.height = `${Math.round(viewport.height / density)}px`;
        renderTask = pdfPage.render({ canvas: target, viewport });
        return renderTask.promise;
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, nearby, page]);

  return (
    <div
      ref={host}
      className="grid min-h-28 w-36 place-items-center rounded bg-fill/60 p-1"
    >
      {failed ? (
        <span className="text-xs text-tertiary">Page {page}</span>
      ) : nearby ? (
        <canvas ref={canvas} className="max-w-full bg-white shadow-sm" />
      ) : null}
    </div>
  );
}
