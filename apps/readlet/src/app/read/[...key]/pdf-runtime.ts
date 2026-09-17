"use client";

/**
 * PDF.js's viewer is not an independent module: it reads `globalThis.pdfjsLib`
 * while evaluating, and the core build installs that global. Keep the ordering
 * and worker configuration at one boundary so no caller can import the viewer
 * before the core has finished loading.
 */

export const PDFJS_ASSETS = "/pdfjs/";

type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfViewer = typeof import("pdfjs-dist/legacy/web/pdf_viewer.mjs");

/** The dependency order used by the runtime, kept testable without a DOM. */
export async function initializePdfRuntime<Core, Viewer>(
  loadCore: () => Promise<Core>,
  loadViewer: () => Promise<Viewer>,
): Promise<{ core: Core; viewer: Viewer }> {
  const core = await loadCore();
  const viewer = await loadViewer();
  return { core, viewer };
}

let coreLoading: Promise<Pdfjs> | null = null;
let runtimeLoading: Promise<{ core: Pdfjs; viewer: PdfViewer }> | null = null;

/** Document-only consumers need no viewer code. */
export function loadPdfCore(): Promise<Pdfjs> {
  // The modern build assumes every current JavaScript proposal is present in
  // the browser. In particular, pdf.js 6 uses the Map upsert methods before a
  // document is opened. Its legacy build supplies those compatibility shims
  // while exposing the same viewer API.
  coreLoading ??= import("pdfjs-dist/legacy/build/pdf.mjs")
    .then((core) => {
      core.GlobalWorkerOptions.workerSrc = `${PDFJS_ASSETS}pdf.worker.min.mjs`;
      return core;
    })
    .catch((error: unknown) => {
      coreLoading = null;
      throw error;
    });
  return coreLoading;
}

/** Viewer consumers get the configured core and its dependent module together. */
export function loadPdfRuntime(): Promise<{ core: Pdfjs; viewer: PdfViewer }> {
  runtimeLoading ??= initializePdfRuntime(
    loadPdfCore,
    () => import("pdfjs-dist/legacy/web/pdf_viewer.mjs"),
  ).catch((error: unknown) => {
    runtimeLoading = null;
    throw error;
  });
  return runtimeLoading;
}
