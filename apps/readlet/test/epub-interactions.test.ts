import assert from "node:assert/strict";
import { test } from "node:test";
import type { Rendition } from "epubjs";
import { epubInteractions } from "../src/app/read/[...key]/epub-interactions.ts";

function touch(
  start: [number, number],
  end: [number, number],
  selected: boolean,
) {
  const selection = { isCollapsed: !selected };
  return {
    start: {
      target: null,
      touches: [{ clientX: start[0], clientY: start[1] }],
      view: { getSelection: () => selection },
    } as unknown as TouchEvent,
    end: {
      target: null,
      changedTouches: [{ clientX: end[0], clientY: end[1] }],
      view: { getSelection: () => selection },
    } as unknown as TouchEvent,
  };
}

test("EPUB text selection takes priority over mobile page gestures", () => {
  let previous = 0;
  let next = 0;
  const rendition = {
    current: {
      prev: () => previous++,
      next: () => next++,
    } as unknown as Rendition,
  };
  const interactions = epubInteractions({
    element: { clientWidth: 400 } as HTMLElement,
    rendition,
    readingView: "paged",
    selectionOpen: { current: false },
    suppressNavigationUntil: { current: 0 },
    toggleChrome: () => {},
  });

  const selectionGesture = touch([300, 100], [100, 100], true);
  interactions.onTouchStart(selectionGesture.start);
  interactions.onTouchEnd(selectionGesture.end);
  assert.deepEqual({ previous, next }, { previous: 0, next: 0 });

  const pageGesture = touch([300, 100], [100, 100], false);
  interactions.onTouchStart(pageGesture.start);
  interactions.onTouchEnd(pageGesture.end);
  assert.deepEqual({ previous, next }, { previous: 0, next: 1 });
});
