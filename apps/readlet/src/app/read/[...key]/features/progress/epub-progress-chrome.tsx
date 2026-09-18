"use client";

/** Book-level reading progress, shown once locations-based percent is known. */
export function EpubProgressBar({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  return (
    <div
      role="progressbar"
      aria-label="Book progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1 w-full bg-separator"
    >
      <div
        className="h-full bg-accent transition-[width] duration-200"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function EpubBookPercent({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  return (
    <span className="shrink-0 text-sm tabular-nums text-secondary">
      {percent}%
    </span>
  );
}

export function EpubChapterPercent({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  return (
    <p className="min-w-0 truncate text-xs text-tertiary">
      {percent}% of chapter
    </p>
  );
}
