/** Shown until the first readable page is on screen. The work has no reliable total. */
export function ReaderLoading({ label = "Opening book…" }: { label?: string }) {
  return (
    <div className="w-full max-w-xs px-6 text-center" role="status">
      <p className="mb-4 text-sm text-secondary">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        className="h-1.5 overflow-hidden rounded-full bg-fill"
      >
        <div className="reader-loading-bar h-full w-1/3 rounded-full bg-accent" />
      </div>
    </div>
  );
}
