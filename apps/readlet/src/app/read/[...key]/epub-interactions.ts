import type { Rendition } from "epubjs";
import type { RefObject } from "react";

const SWIPE_DISTANCE = 60;

/** Input from the rendition iframe and the host window, with selection taking priority. */
export function epubInteractions({
  element,
  rendition,
  readingView,
  selectionOpen,
  suppressNavigationUntil,
  toggleChrome,
}: {
  element: HTMLElement;
  rendition: RefObject<Rendition | null>;
  readingView: "paged" | "scroll";
  selectionOpen: RefObject<boolean>;
  suppressNavigationUntil: RefObject<number>;
  toggleChrome: () => void;
}) {
  let gesture: { x: number; y: number } | null = null;
  let suppressClickUntil = 0;
  const selected = (event: UIEvent) => {
    const selection = event.view?.getSelection();
    return Boolean(selection && !selection.isCollapsed);
  };
  const interactive = (target: EventTarget | null) => {
    const node = target as { closest?: (selector: string) => Element | null };
    return Boolean(
      node?.closest?.("a, button, input, textarea, select, [role=button]"),
    );
  };
  const blocked = () =>
    selectionOpen.current || Date.now() < suppressNavigationUntil.current;

  function onKeyDown(event: { key?: string; target?: EventTarget | null }) {
    if (blocked()) return;
    const tagName = (event.target as { tagName?: string } | null)?.tagName;
    if (tagName === "INPUT" || tagName === "SELECT" || tagName === "BUTTON")
      return;
    if (event.key === "ArrowLeft") rendition.current?.prev();
    if (event.key === "ArrowRight") rendition.current?.next();
  }
  function onClick(event: MouseEvent) {
    if (
      blocked() ||
      Date.now() < suppressClickUntil ||
      interactive(event.target) ||
      selected(event)
    )
      return;
    const position =
      event.clientX /
      Math.max(event.view?.innerWidth ?? element.clientWidth, 1);
    if (readingView !== "scroll" && position < 0.24) rendition.current?.prev();
    else if (readingView !== "scroll" && position > 0.76)
      rendition.current?.next();
    else toggleChrome();
  }
  function onTouchStart(event: TouchEvent) {
    if (interactive(event.target) || event.touches.length !== 1) {
      gesture = null;
      return;
    }
    const point = event.touches[0];
    gesture = point ? { x: point.clientX, y: point.clientY } : null;
  }
  function onTouchEnd(event: TouchEvent) {
    const start = gesture;
    gesture = null;
    if (!start || blocked() || readingView === "scroll" || selected(event))
      return;
    const point = event.changedTouches[0];
    if (!point) return;
    const movedX = point.clientX - start.x;
    const movedY = point.clientY - start.y;
    if (
      Math.abs(movedX) >= SWIPE_DISTANCE &&
      Math.abs(movedX) > Math.abs(movedY)
    ) {
      suppressClickUntil = Date.now() + 500;
      if (movedX < 0) rendition.current?.next();
      else rendition.current?.prev();
    }
  }
  return { onKeyDown, onClick, onTouchStart, onTouchEnd };
}
