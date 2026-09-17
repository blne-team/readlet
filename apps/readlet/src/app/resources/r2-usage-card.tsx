import type { R2UsageStatus } from "@readlet/provider-r2/worker";

const TONE: Record<R2UsageStatus["level"], string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-orange-500",
  blocked: "bg-red-500",
};

function percent(value: number): string {
  return `${Math.min(100, value * 100).toFixed(value < 0.01 ? 2 : 0)}%`;
}

function count(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function bytes(value: number): string {
  return `${(value / 1_000_000_000).toFixed(2)} GB`;
}

function Meter({
  label,
  used,
  limit,
  ratio,
  tone,
  format = count,
}: {
  label: string;
  used: number;
  limit: number;
  ratio: number;
  tone: string;
  format?: (value: number) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-secondary">
          {format(used)} / {format(limit)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-fill">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: percent(ratio) }}
        />
      </div>
    </div>
  );
}

export function R2UsageCard({ status }: { status: R2UsageStatus }) {
  const start = new Date(status.periodStartedAt).toLocaleDateString("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const end = new Date(status.periodEndsAt).toLocaleDateString("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  return (
    <section className="mt-10 rounded-2xl border border-separator p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">R2 safety budget</h2>
          <p className="mt-1 text-sm text-secondary">
            {start}–{end} · capped at 80% of the Standard free tier
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-fill px-3 py-1 text-sm font-medium capitalize">
          <span className={`size-2 rounded-full ${TONE[status.level]}`} />
          {status.level}
        </span>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <Meter label="Class A" {...status.classA} tone={TONE[status.level]} />
        <Meter label="Class B" {...status.classB} tone={TONE[status.level]} />
        <Meter
          label="Reserved storage"
          {...status.storage}
          tone={TONE[status.level]}
          format={bytes}
        />
      </div>
    </section>
  );
}
