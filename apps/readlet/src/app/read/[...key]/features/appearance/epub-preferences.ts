import type { CSSProperties } from "react";
import { readStored, writeStored } from "@/lib/local";

export type ReadingView = "paged" | "scroll";
export type EpubTheme = "system" | "paper" | "sepia" | "night";
export type ColumnCount = "auto" | "one" | "two";
export type FontFamily = "publisher" | "serif" | "sans";
export type FontWeight = "publisher" | "400" | "500" | "600" | "700";
export type TextAlignment = "publisher" | "start" | "justify";

export type EpubPreferences = {
  view: ReadingView;
  theme: EpubTheme;
  columns: ColumnCount;
  fontSize: number;
  fontFamily: FontFamily;
  fontWeight: FontWeight;
  lineHeight: number;
  paragraphSpacing: number;
  letterSpacing: number;
  textAlignment: TextAlignment;
  margin: number;
  maxTextWidth: number;
};

export const DEFAULT_EPUB_PREFERENCES: EpubPreferences = {
  view: "scroll",
  theme: "system",
  columns: "auto",
  fontSize: 100,
  fontFamily: "publisher",
  fontWeight: "publisher",
  lineHeight: 1.5,
  paragraphSpacing: 0,
  letterSpacing: 0,
  textAlignment: "publisher",
  margin: 24,
  maxTextWidth: 68,
};

const STORAGE_KEY = "readlet:epub:preferences";

const FONT_STACKS: Record<Exclude<FontFamily, "publisher">, string> = {
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
};

/** Device-wide EPUB preferences. A malformed browser value simply resets. */
export function readEpubPreferences(): EpubPreferences {
  const stored = readStored(STORAGE_KEY);
  if (!stored) return DEFAULT_EPUB_PREFERENCES;

  try {
    return { ...DEFAULT_EPUB_PREFERENCES, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_EPUB_PREFERENCES;
  }
}

export function writeEpubPreferences(preferences: EpubPreferences): void {
  writeStored(STORAGE_KEY, JSON.stringify(preferences));
}

/**
 * The user stylesheet injected after the EPUB's own CSS.
 *
 * Typography is intentionally scoped to ordinary prose. Headings keep their
 * relative hierarchy, and code keeps a monospace face even when the reader
 * chooses a different family for the book.
 */
export function epubPreferenceCss(preferences: EpubPreferences): string {
  const theme = (paper: string, ink: string, link: string, scheme: string) => `
html { color-scheme: ${scheme}; }
html, body { background-color: ${paper} !important; color: ${ink} !important; }
body :is(p, li, blockquote, dd, dt, h1, h2, h3, h4, h5, h6) { color: ${ink} !important; }
body a { color: ${link} !important; }`;
  const paperTheme = theme("#ffffff", "#1d1d1f", "#0071e3", "light");
  const nightTheme = theme("#111112", "#f5f5f7", "#6ab5ff", "dark");
  const themeCss =
    preferences.theme === "system"
      ? `${paperTheme}\n@media (prefers-color-scheme: dark) { ${nightTheme} }`
      : preferences.theme === "sepia"
        ? theme("#f4ecdc", "#43382a", "#765c39", "light")
        : preferences.theme === "night"
          ? nightTheme
          : paperTheme;
  const family =
    preferences.fontFamily === "publisher"
      ? ""
      : `
body, body * { font-family: ${FONT_STACKS[preferences.fontFamily]} !important; }
pre, code, kbd, samp, tt { font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important; }`;
  const weight =
    preferences.fontWeight === "publisher"
      ? ""
      : `
body, p, li, blockquote, dd, dt { font-weight: ${preferences.fontWeight} !important; }
b, strong { font-weight: bolder !important; }`;
  const alignment =
    preferences.textAlignment === "publisher"
      ? ""
      : `
p, li, blockquote, dd, dt { text-align: ${preferences.textAlignment} !important; }`;

  return `
html { font-size: ${preferences.fontSize}% !important; }
body {
  font-size: 1rem !important;
  line-height: ${preferences.lineHeight} !important;
  letter-spacing: ${preferences.letterSpacing}em !important;
}
p, li, blockquote, dd, dt {
  line-height: inherit !important;
  letter-spacing: inherit !important;
}
p { margin-block-end: ${preferences.paragraphSpacing}em !important; }
${family}${weight}${alignment}${themeCss}
`;
}

/**
 * Keeps one line of prose readable even when the app has a very wide window.
 * The outer box uses the chosen reading size so its `ch` tracks the text it
 * contains closely enough without reaching into an iframe to measure a font.
 */
export function epubViewportStyle(preferences: EpubPreferences): CSSProperties {
  const visibleColumns =
    preferences.view === "scroll" || preferences.columns === "one" ? 1 : 2;
  const gap = visibleColumns === 2 ? " + 2rem" : "";
  const margin = `min(${preferences.margin}px, max(12px, 4vw))`;

  return {
    top: margin,
    right: margin,
    bottom: margin,
    left: margin,
    width: "auto",
    maxWidth: `calc(${preferences.maxTextWidth * visibleColumns}ch${gap})`,
    fontSize: `${preferences.fontSize}%`,
    fontFamily:
      preferences.fontFamily === "publisher"
        ? FONT_STACKS.serif
        : FONT_STACKS[preferences.fontFamily],
  };
}
