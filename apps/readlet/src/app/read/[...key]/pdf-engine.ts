"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { type Opened, openPdf } from "./pdf-document";
import { loadPdfRuntime, PDFJS_ASSETS } from "./pdf-runtime";
import type {
  PdfFindSnapshot,
  PdfLayout,
  PdfPreferences,
  PdfSnapshot,
  PdfZoom,
} from "./pdf-types";
import { startPdfViewer } from "./pdf-viewer-lifecycle";
import { acquirePdfViewerInputs } from "./pdf-viewer-startup";

type ViewerModule = typeof import("pdfjs-dist/legacy/web/pdf_viewer.mjs");
type Viewer = InstanceType<ViewerModule["PDFViewer"]>;
type ViewerOptions = ConstructorParameters<ViewerModule["PDFViewer"]>[0] & {
  /** Supported by PDFViewer but missing from pdfjs-dist's generated declaration. */
  abortSignal: AbortSignal;
};
type LinkService = InstanceType<ViewerModule["PDFLinkService"]>;
type EventBus = InstanceType<ViewerModule["EventBus"]>;
type Destination = Parameters<LinkService["goToDestination"]>[0];
type Listener = (event: Record<string, unknown>) => void;
type ViewerLifecycle = {
  setDocument: (document: PDFDocumentProxy | null) => void;
};

export type PdfEngineElements = {
  container: HTMLDivElement;
  viewer: HTMLDivElement;
};

export type PdfEngineOptions = {
  url: string;
  elements: PdfEngineElements;
  preferences: PdfPreferences;
  page: number;
};

const FIND_OPTIONS = {
  phraseSearch: true,
  caseSensitive: false,
  entireWord: false,
  highlightAll: true,
  matchDiacritics: false,
} as const;

/**
 * The imperative boundary around PDF.js's viewer layer.
 *
 * PDF.js owns the page DOM and rendering queue. React owns the surrounding
 * controls and observes this small snapshot instead of reconciling hundreds of
 * page canvases and text layers itself.
 */
export class PdfEngine {
  readonly document: PDFDocumentProxy;
  readonly container: HTMLDivElement;

  readonly #opened: Opened;
  readonly #module: ViewerModule;
  readonly #viewer: Viewer;
  readonly #linkService: LinkService;
  readonly #eventBus: EventBus;
  readonly #abortController: AbortController;
  readonly #listeners: Array<[string, Listener]> = [];
  readonly #subscribers = new Set<() => void>();

  #find: PdfFindSnapshot = { current: 0, total: 0, pending: false };
  #snapshot: PdfSnapshot;
  #query = "";
  #layout: PdfLayout | null = null;

  private constructor({
    opened,
    module,
    viewer,
    linkService,
    eventBus,
    abortController,
    container,
  }: {
    opened: Opened;
    module: ViewerModule;
    viewer: Viewer;
    linkService: LinkService;
    eventBus: EventBus;
    abortController: AbortController;
    container: HTMLDivElement;
  }) {
    this.#opened = opened;
    this.#module = module;
    this.#viewer = viewer;
    this.#linkService = linkService;
    this.#eventBus = eventBus;
    this.#abortController = abortController;
    this.container = container;
    this.document = opened.doc;
    this.#snapshot = {
      document: opened.doc,
      page: 1,
      pageLabel: null,
      pageLabels: null,
      pages: opened.doc.numPages,
      scale: 1,
      find: this.#find,
    };

    this.#listen("pagechanging", (event) => {
      this.#update({
        page: event.pageNumber as number,
        pageLabel: (event.pageLabel as string | null) ?? null,
      });
    });
    this.#listen("scalechanging", (event) => {
      this.#update({ scale: event.scale as number });
    });
    this.#listen("updatefindmatchescount", (event) => {
      this.#setFind(event.matchesCount as { current: number; total: number });
    });
    this.#listen("updatefindcontrolstate", (event) => {
      const count = event.matchesCount as { current: number; total: number };
      this.#setFind(count, event.state === module.FindState.PENDING);
    });
  }

  static async create(options: PdfEngineOptions): Promise<PdfEngine> {
    const { runtime, opened } = await acquirePdfViewerInputs(
      loadPdfRuntime,
      () => openPdf(options.url),
    );
    const { core: pdfjs, viewer: module } = runtime;
    const { container, viewer: viewerElement } = options.elements;
    const abortController = new AbortController();
    let engine: PdfEngine | null = null;
    try {
      const eventBus = new module.EventBus();
      const linkService = new module.PDFLinkService({
        eventBus,
        externalLinkTarget: module.LinkTarget.BLANK,
        externalLinkRel: "noopener noreferrer",
      });
      const findController = new module.PDFFindController({
        eventBus,
        linkService,
        updateMatchesCountOnProgress: true,
      });
      const viewerOptions: ViewerOptions = {
        container,
        viewer: viewerElement,
        eventBus,
        linkService,
        findController,
        annotationMode: pdfjs.AnnotationMode.ENABLE,
        imageResourcesPath: `${PDFJS_ASSETS}images/`,
        removePageBorders: true,
        enableDetailCanvas: true,
        enableOptimizedPartialRendering: true,
        supportsPinchToZoom: true,
        abortSignal: abortController.signal,
      };
      const viewer = new module.PDFViewer(viewerOptions);
      linkService.setViewer(viewer);

      engine = new PdfEngine({
        opened,
        module,
        viewer,
        linkService,
        eventBus,
        abortController,
        container,
      });

      linkService.setDocument(opened.doc);
      const initializedEngine = engine;
      await startPdfViewer(
        viewer,
        eventBus,
        opened.doc,
        opened.doc.numPages,
        () => {
          initializedEngine.setLayout(options.preferences.layout);
          initializedEngine.setZoom(options.preferences.zoom);
          initializedEngine.goToPage(options.page);
          initializedEngine.#synchronize();
        },
      );

      // Page labels enrich the chrome but are not required for a first page.
      // A malformed label tree must not hold the reader's first paint hostage.
      void opened.doc
        .getPageLabels()
        .then((labels) => {
          if (abortController.signal.aborted) return;
          viewer.setPageLabels(labels);
          initializedEngine.#update({ pageLabels: labels });
        })
        .catch((error: unknown) => {
          console.warn("PDF page labels could not be read", error);
        });
      engine.#synchronize();
      return engine;
    } catch (error) {
      if (engine) engine.destroy();
      else {
        abortController.abort();
        opened.close();
      }
      throw error;
    }
  }

  getSnapshot = (): PdfSnapshot => this.#snapshot;

  subscribe = (subscriber: () => void): (() => void) => {
    this.#subscribers.add(subscriber);
    return () => this.#subscribers.delete(subscriber);
  };

  focus(): void {
    this.container.focus({ preventScroll: true });
  }

  goToPage(target: number | string): void {
    if (typeof target === "number") {
      this.#viewer.currentPageNumber = Math.min(
        Math.max(Math.trunc(target), 1),
        this.document.numPages,
      );
      return;
    }
    this.#linkService.goToPage(target.trim());
  }

  goToDestination(destination: Destination): void {
    void this.#linkService.goToDestination(destination);
  }

  turn(direction: 1 | -1): void {
    if (direction === 1) this.#viewer.nextPage();
    else this.#viewer.previousPage();
  }

  setLayout(layout: PdfLayout): void {
    // `create` applies the initial layout before exposing the engine. React's
    // synchronization effect then asks for that same layout once more when the
    // engine enters state. Reapplying it makes PDF.js tear down and rebuild its
    // pages, and restoring the current page during that gap can try to scroll a
    // detached page (`offsetParent is not set`) and leave an empty viewer.
    if (layout === this.#layout) return;

    const page = this.#viewer.currentPageNumber;
    if (layout === "scroll") {
      this.#viewer.spreadMode = this.#module.SpreadMode.NONE;
      this.#viewer.scrollMode = this.#module.ScrollMode.VERTICAL;
    } else {
      this.#viewer.scrollMode = this.#module.ScrollMode.PAGE;
      this.#viewer.spreadMode =
        layout === "spread"
          ? this.#module.SpreadMode.EVEN
          : this.#module.SpreadMode.NONE;
    }
    this.#viewer.currentPageNumber = page;
    this.#layout = layout;
  }

  setZoom(zoom: PdfZoom): void {
    this.#viewer.currentScaleValue =
      typeof zoom === "number"
        ? String(zoom)
        : ({ auto: "auto", width: "page-width", page: "page-fit" } as const)[
            zoom
          ];
  }

  zoomBy(scaleFactor: number, origin: [number, number]): void {
    this.#viewer.updateScale({ scaleFactor, origin, drawingDelay: 180 });
  }

  rotate(): void {
    this.#viewer.pagesRotation = (this.#viewer.pagesRotation + 90) % 360;
  }

  find(query: string): void {
    this.#query = query;
    if (!query) {
      this.#eventBus.dispatch("findbarclose", { source: this });
      this.#find = { current: 0, total: 0, pending: false };
      this.#update({ find: this.#find });
      return;
    }

    this.#eventBus.dispatch("find", {
      source: this,
      type: "",
      query,
      findPrevious: false,
      ...FIND_OPTIONS,
    });
  }

  findAgain(previous: boolean): void {
    if (!this.#query) return;
    this.#eventBus.dispatch("find", {
      source: this,
      type: "again",
      query: this.#query,
      findPrevious: previous,
      ...FIND_OPTIONS,
    });
  }

  destroy(): void {
    for (const [name, listener] of this.#listeners) {
      this.#eventBus.off(name, listener);
    }
    this.#listeners.length = 0;
    this.#subscribers.clear();
    this.#abortController.abort();
    (this.#viewer as ViewerLifecycle).setDocument(null);
    this.#linkService.setDocument(null);
    this.#opened.close();
  }

  #listen(name: string, listener: Listener): void {
    this.#listeners.push([name, listener]);
    this.#eventBus.on(name, listener);
  }

  #setFind(
    count: { current: number; total: number },
    pending = this.#find.pending,
  ): void {
    this.#find = { ...count, pending };
    this.#update({ find: this.#find });
  }

  #synchronize(): void {
    this.#snapshot = {
      ...this.#snapshot,
      page: this.#viewer.currentPageNumber,
      pageLabel: this.#viewer.currentPageLabel,
      scale: this.#viewer.currentScale,
      find: this.#find,
    };
    this.#emit();
  }

  #update(update: Partial<PdfSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...update };
    this.#emit();
  }

  #emit(): void {
    for (const subscriber of this.#subscribers) subscriber();
  }
}
