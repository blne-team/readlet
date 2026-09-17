"use client";

import type { Book, NavItem, Rendition } from "epubjs";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { epubInteractions } from "./epub-interactions";
import type { EpubPreferences } from "./features/appearance/epub-preferences";
import {
  computeEpubProgress,
  type EpubProgress,
  resolveEpubChapter,
} from "./features/progress/epub-progress";
import type { Position } from "./features/progress/position";
import { useEpubLocations } from "./features/progress/use-epub-locations";

const PREFETCH_AHEAD = 2;
const COMPACT_READER_WIDTH = 640;

function flatten(
  items: NavItem[],
  depth = 0,
): { item: NavItem; depth: number }[] {
  return items.flatMap((item) => [
    { item, depth },
    ...flatten(item.subitems ?? [], depth + 1),
  ]);
}

type SpineItem = { href: string; index: number; linear?: string };

function spineItems(book: Book): SpineItem[] {
  return (
    (book.spine as unknown as { spineItems?: SpineItem[] }).spineItems ?? []
  );
}

function firstReadableHref(book: Book): string | undefined {
  return spineItems(book).find(
    (item) => item.linear !== "no" && !/cover/i.test(item.href),
  )?.href;
}

/** The imperative EPUB.js boundary. React observes the small state it reports. */
export function useEpubRuntime({
  opfUrl,
  restored,
  readingView,
  columns,
  preferenceCss,
  current,
  record,
  selectionOpen,
  suppressNavigationUntil,
  onToggleChrome,
  onSelected,
}: {
  opfUrl: string;
  restored: boolean;
  readingView: EpubPreferences["view"];
  columns: EpubPreferences["columns"];
  preferenceCss: string;
  current: Position["current"];
  record: Position["record"];
  selectionOpen: RefObject<boolean>;
  suppressNavigationUntil: RefObject<number>;
  onToggleChrome: () => void;
  onSelected: (cfi: string, contents: { window?: Window }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [location, setLocation] = useState<{
    cfi?: string;
    href?: string;
  } | null>(null);
  const [toc, setToc] = useState<{ item: NavItem; depth: number }[]>([]);
  const { locations, spine } = useEpubLocations(book, opfUrl);
  const progress = useMemo<EpubProgress>(() => {
    const chapter = resolveEpubChapter(
      location?.href,
      toc.map(({ item }) => ({ href: item.href, label: item.label })),
      spine,
    );
    return computeEpubProgress(location?.cfi, locations, chapter);
  }, [location?.cfi, location?.href, locations, spine, toc]);
  const cssRef = useRef(preferenceCss);
  const selectedCallback = useRef(onSelected);
  useEffect(() => {
    cssRef.current = preferenceCss;
  }, [preferenceCss]);
  useEffect(() => {
    selectedCallback.current = onSelected;
  }, [onSelected]);

  useEffect(() => {
    const element = container.current;
    if (!element || !restored) return;
    const host = element;

    let openedBook: Book | null = null;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    const interaction = epubInteractions({
      element: host,
      rendition,
      readingView,
      selectionOpen,
      suppressNavigationUntil,
      toggleChrome: onToggleChrome,
    });

    /**
     * Warms the browser cache with the sections just ahead, so turning the page
     * doesn't wait on a round trip out to R2 and back.
     */
    function prefetchAhead(opened: Book, index?: number) {
      if (typeof index !== "number") return;
      const items = spineItems(opened);
      for (let i = index + 1; i <= index + PREFETCH_AHEAD; i++) {
        const next = items[i];
        if (!next) break;
        // A prefetch that fails costs nothing; the real load will retry.
        void fetch(opened.resolve(next.href)).catch(() => {});
      }
    }

    /** Reflow only when the reader box changes after the first display. */
    function observeSize(view: Rendition) {
      if (observer) return;
      const initial = host.getBoundingClientRect();
      let lastWidth = initial.width;
      let lastHeight = initial.height;
      observer = new ResizeObserver(([entry]) => {
        if (!entry || cancelled) return;
        const { width, height } = entry.contentRect;
        // ResizeObserver always sends an initial notification. EPUB.js clears
        // its views on resize, so leave the first displayed chapter in place.
        if (
          width <= 0 ||
          height <= 0 ||
          (Math.abs(width - lastWidth) < 1 && Math.abs(height - lastHeight) < 1)
        ) {
          return;
        }
        lastWidth = width;
        lastHeight = height;
        view.spread(
          readingView === "scroll" ||
            columns === "one" ||
            width < COMPACT_READER_WIDTH
            ? "none"
            : "auto",
          columns === "two" ? 560 : 800,
        );
        view.resize(width, height);
      });
      observer.observe(host);
    }

    setStatus("loading");
    setBook(null);
    setLocation(null);

    // epub.js touches window at import time, so it is loaded here rather than
    // at module scope, where it would break the server render.
    import("epubjs")
      .then(({ default: ePub }) => {
        if (cancelled) return;

        // Pointed at the .opf so epub.js fetches chapters one at a time instead
        // of pulling down the entire archive.
        const opened = ePub(opfUrl);
        openedBook = opened;

        const initialWidth = host.getBoundingClientRect().width;
        const view = opened.renderTo(element, {
          width: "100%",
          height: "100%",
          flow: readingView === "scroll" ? "scrolled" : "paginated",
          // The continuous manager appends the next section as you reach the
          // end of one, so scrolling runs through the book rather than
          // stopping dead at each chapter boundary.
          manager: readingView === "scroll" ? "continuous" : "default",
          spread:
            readingView === "scroll" ||
            columns === "one" ||
            initialWidth < COMPACT_READER_WIDTH
              ? "none"
              : "auto",
          // "Two" remains one column on a phone; "Automatic" uses epub.js's
          // more conservative book-like breakpoint.
          minSpreadWidth: columns === "two" ? 560 : 800,
          // Book markup is untrusted: no scripts inside the iframe.
          allowScriptedContent: false,
        });
        view.themes.registerCss("readlet-preferences", cssRef.current);
        view.themes.select("readlet-preferences");
        rendition.current = view;

        view.on("selected", (cfi: string, contents: { window?: Window }) =>
          selectedCallback.current(cfi, contents),
        );

        // Fires for every move — buttons, keyboard and contents jumps alike —
        // so position and label stay in step however the reader got there.
        view.on(
          "relocated",
          (location: {
            start?: { cfi?: string; href?: string; index?: number };
          }) => {
            setLocation({
              cfi: location.start?.cfi,
              href: location.start?.href,
            });

            if (location.start?.cfi) {
              record({ cfi: location.start.cfi, href: location.start.href });
            }

            prefetchAhead(opened, location.start?.index);
            observeSize(view);
            setStatus("ready");
          },
        );

        // Arrow keys while the book itself has focus: epub.js re-emits DOM
        // events from inside its iframe, which a window listener never sees.
        view.on("keydown", interaction.onKeyDown);
        view.on("click", interaction.onClick);
        view.on("touchstart", interaction.onTouchStart);
        view.on("touchend", interaction.onTouchEnd);
        // epub.js emits this event when a chapter request fails, but does not
        // reject the promise returned by `display()`. Without the event handler
        // below, the promise chain remains pending and the reader looks blank
        // forever instead of reporting the failed load.
        view.on("displayerror", (error: unknown) => {
          console.error("The EPUB reader could not display a chapter", error);
          if (!cancelled) setStatus("error");
        });

        opened.loaded.navigation
          .then((navigation) => {
            if (!cancelled) setToc(flatten(navigation.toc));
          })
          .catch(() => {
            // A book with no usable nav document still reads front to back.
          });

        // `ready` resolves once the spine is parsed, which is what tells us
        // where the cover ends and the book begins.
        return opened.ready.then(() => {
          if (!cancelled) setBook(opened);
          return view.display(current()?.cfi ?? firstReadableHref(opened));
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    window.addEventListener("keydown", interaction.onKeyDown);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", interaction.onKeyDown);
      observer?.disconnect();
      rendition.current = null;
      setBook(null);
      openedBook?.destroy();
    };
    // View and columns rebuild the rendition: epub.js reflows far more reliably
    // from a fresh render than from a structural change applied to a live one,
    // and the saved position puts the reader straight back where it was.
  }, [
    opfUrl,
    readingView,
    columns,
    restored,
    current,
    record,
    onToggleChrome,
    selectionOpen,
    suppressNavigationUntil,
  ]);

  // Text settings can update the stylesheet in every open chapter without
  // rebuilding the book. Redisplaying its leading CFI keeps the same sentence
  // at the start after pagination changes.
  useEffect(() => {
    const view = rendition.current;
    if (!view) return;

    const cfi = view.location?.start?.cfi;
    view.themes.registerCss("readlet-preferences", preferenceCss);
    view.themes.select("readlet-preferences");
    const anchor = window.setTimeout(() => {
      if (cfi) void view.display(cfi);
    }, 80);
    return () => window.clearTimeout(anchor);
  }, [preferenceCss]);

  return { container, rendition, status, progress, toc };
}
