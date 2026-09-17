/**
 * The app's shared control styles, in the Apple idiom: pill-shaped buttons
 * shaped by fills rather than borders or shadows, one accent color for the
 * primary action on a screen, and quiet text buttons for everything minor.
 */

/** The one thing to do on this screen: a filled accent pill. */
export const BUTTON_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover";

/** A normal action: a gray-fill pill that darkens on hover. */
export const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-fill px-3.5 py-2 text-sm font-medium transition-colors hover:bg-fill-hover";

/** A minor action: just text until hovered. */
export const BUTTON_QUIET =
  "inline-flex min-h-11 items-center justify-center rounded-full px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-fill hover:text-foreground";

/** Text fields: a fill instead of a border, and the accent only on focus. */
export const INPUT =
  "min-h-11 rounded-lg bg-fill px-3 py-2 text-sm outline-none transition-shadow placeholder:text-tertiary focus:ring-2 focus:ring-accent";

/**
 * An icon button: the same fill as {@link BUTTON}, sized for a glyph rather
 * than for words, and dimmed when there is nowhere for it to go.
 */
export const BUTTON_ROUND =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-fill transition-colors enabled:hover:bg-fill-hover disabled:opacity-40";

/** A `<select>`: a fill instead of a border, like the text fields above. */
export const SELECT =
  "min-h-11 rounded-lg bg-fill px-3 py-2 text-sm outline-none transition-colors hover:bg-fill-hover";
