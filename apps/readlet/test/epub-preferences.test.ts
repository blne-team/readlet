import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_EPUB_PREFERENCES,
  epubPreferenceCss,
  epubViewportStyle,
} from "../src/app/read/[...key]/features/appearance/epub-preferences.ts";

test("continuous scroll is the default EPUB reading view", () => {
  assert.equal(DEFAULT_EPUB_PREFERENCES.view, "scroll");
});

test("the default EPUB settings preserve the publisher's family and weight", () => {
  const css = epubPreferenceCss(DEFAULT_EPUB_PREFERENCES);

  assert.match(css, /font-size: 100%/);
  assert.match(css, /line-height: 1.5/);
  assert.doesNotMatch(css, /body, body \* \{ font-family/);
  assert.doesNotMatch(css, /body, p, li, blockquote, dd, dt \{ font-weight/);
  assert.doesNotMatch(css, /text-align/);
});

test("EPUB page themes keep prose and links readable across device colors", () => {
  const system = epubPreferenceCss(DEFAULT_EPUB_PREFERENCES);
  const sepia = epubPreferenceCss({
    ...DEFAULT_EPUB_PREFERENCES,
    theme: "sepia",
  });
  const night = epubPreferenceCss({
    ...DEFAULT_EPUB_PREFERENCES,
    theme: "night",
  });

  assert.match(system, /prefers-color-scheme: dark/);
  assert.match(sepia, /background-color: #f4ecdc/);
  assert.match(sepia, /body a \{ color: #765c39/);
  assert.match(night, /color-scheme: dark/);
  assert.match(night, /body a \{ color: #6ab5ff/);
});

test("chosen typography becomes explicit reader CSS", () => {
  const css = epubPreferenceCss({
    ...DEFAULT_EPUB_PREFERENCES,
    fontSize: 125,
    fontFamily: "sans",
    fontWeight: "600",
    lineHeight: 1.7,
    paragraphSpacing: 0.8,
    letterSpacing: 0.04,
    textAlignment: "justify",
  });

  assert.match(css, /font-size: 125%/);
  assert.match(css, /font-family: ui-sans-serif/);
  assert.match(css, /font-weight: 600/);
  assert.match(css, /line-height: 1.7/);
  assert.match(css, /margin-block-end: 0.8em/);
  assert.match(css, /letter-spacing: 0.04em/);
  assert.match(css, /text-align: justify/);
  assert.match(css, /pre, code, kbd, samp, tt.*ui-monospace/);
});

test("maximum text width describes one column or a two-column spread", () => {
  const one = epubViewportStyle({
    ...DEFAULT_EPUB_PREFERENCES,
    view: "paged",
    columns: "one",
    maxTextWidth: 72,
  });
  const two = epubViewportStyle({
    ...DEFAULT_EPUB_PREFERENCES,
    view: "paged",
    columns: "two",
    maxTextWidth: 72,
  });
  const scroll = epubViewportStyle({
    ...DEFAULT_EPUB_PREFERENCES,
    view: "scroll",
    columns: "two",
    maxTextWidth: 72,
  });

  assert.equal(one.maxWidth, "calc(72ch)");
  assert.equal(two.maxWidth, "calc(144ch + 2rem)");
  assert.equal(scroll.maxWidth, "calc(72ch)");
});

test("page margins reduce the rendition on all four sides", () => {
  const style = epubViewportStyle({
    ...DEFAULT_EPUB_PREFERENCES,
    margin: 36,
  });

  assert.equal(style.top, "min(36px, max(12px, 4vw))");
  assert.equal(style.right, style.top);
  assert.equal(style.bottom, style.top);
  assert.equal(style.left, style.top);
  assert.equal(style.width, "auto");
});
