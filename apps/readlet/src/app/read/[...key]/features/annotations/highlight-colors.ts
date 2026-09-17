import {
  HIGHLIGHT_COLORS as COLOR_IDS,
  type HighlightColor,
} from "@/domain/reader-marks";

const FILLS: Record<HighlightColor, string> = {
  yellow: "#f2bd38",
  green: "#65c88a",
  blue: "#78acef",
  pink: "#ed91ba",
};

const LABELS: Record<HighlightColor, string> = {
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  pink: "Pink",
};

export const HIGHLIGHT_COLORS = COLOR_IDS.map((id) => ({
  id,
  label: LABELS[id],
  fill: FILLS[id],
}));

export type { HighlightColor } from "@/domain/reader-marks";

export function highlightFill(color: HighlightColor): string {
  return FILLS[color];
}

/**
 * Highlight fragments are painted as one composited group. Keeping opacity on
 * the group prevents adjacent range rectangles from darkening where their
 * geometry overlaps (a common result from both PDF.js and EPUB.js ranges).
 */
export function highlightPresentation(color: HighlightColor) {
  return {
    fill: highlightFill(color),
    opacity: 0.36,
    blendMode: "multiply" as const,
    cursor: "pointer" as const,
  };
}
