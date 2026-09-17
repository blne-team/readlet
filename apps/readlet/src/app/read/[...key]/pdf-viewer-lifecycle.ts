"use client";

type PageViewer<Document> = {
  setDocument: (document: Document) => void;
  readonly pagesPromise: Promise<unknown> | null;
  readonly pagesCount: number;
};

type PageEventBus = {
  on: (
    name: "pagesinit",
    listener: () => void,
    options: { once: true },
  ) => void;
  off: (name: "pagesinit", listener: () => void) => void;
};

/**
 * PDF.js resolves `firstPagePromise` before it creates the viewer's page views.
 * `pagesinit` is the point to apply layout, zoom and the saved page before the
 * rendering queue starts; with auto-fetch disabled, `pagesPromise` follows the
 * first visible page's render rather than downloading the rest of the book.
 */
export async function startPdfViewer<Document>(
  viewer: PageViewer<Document>,
  eventBus: PageEventBus,
  document: Document,
  expectedPages: number,
  configure: () => void,
): Promise<void> {
  let initialized = false;
  let resolveInitialized!: () => void;
  let rejectInitialized!: (error: unknown) => void;
  const pagesInitialized = new Promise<void>((resolve, reject) => {
    resolveInitialized = resolve;
    rejectInitialized = reject;
  });
  const onPagesInit = () => {
    try {
      configure();
      initialized = true;
      resolveInitialized();
    } catch (error) {
      rejectInitialized(error);
    }
  };

  eventBus.on("pagesinit", onPagesInit, { once: true });
  try {
    viewer.setDocument(document);
    const pagesReady = viewer.pagesPromise;
    if (!pagesReady) throw new Error("PDF viewer did not start its pages");
    await Promise.race([pagesInitialized, pagesReady]);
    if (!initialized || viewer.pagesCount !== expectedPages) {
      throw new Error("PDF viewer finished before its page views were ready");
    }
    await pagesReady;
  } finally {
    eventBus.off("pagesinit", onPagesInit);
  }
}
