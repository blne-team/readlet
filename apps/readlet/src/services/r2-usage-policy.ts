import type { R2UsageStatus } from "@readlet/provider-r2/worker";

export const R2_SAFETY_LIMITS = {
  // 80% of R2 Standard's monthly free allowances.
  classA: 800_000,
  classB: 8_000_000,
  storage: 8_000_000_000,
} as const;

export type R2LedgerState = {
  period_start: string;
  class_a: number;
  class_b: number;
  stored_bytes: number;
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function boundary(year: number, month: number, day: number): Date {
  return new Date(
    Date.UTC(year, month, Math.min(day, daysInMonth(year, month))),
  );
}

export function billingPeriod(
  now: Date,
  billingDay: number,
): { startedAt: Date; endsAt: Date } {
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
    throw new Error("READLET_R2_BILLING_DAY must be an integer from 1 to 31.");
  }

  const thisMonth = boundary(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    billingDay,
  );
  const startedAt =
    now >= thisMonth
      ? thisMonth
      : boundary(now.getUTCFullYear(), now.getUTCMonth() - 1, billingDay);
  const endsAt = boundary(
    startedAt.getUTCFullYear(),
    startedAt.getUTCMonth() + 1,
    billingDay,
  );
  return { startedAt, endsAt };
}

function counter(used: number, limit: number) {
  return { used, limit, ratio: used / limit };
}

export function usageLevel(ratio: number): R2UsageStatus["level"] {
  if (ratio >= 1) return "blocked";
  // These are 70% and 60% of the free tier, expressed against its 80% cap.
  if (ratio >= 0.875) return "critical";
  if (ratio >= 0.75) return "warning";
  return "healthy";
}

export function r2UsageStatus(
  ledger: R2LedgerState,
  periodEndsAt: Date,
): R2UsageStatus {
  const classA = counter(ledger.class_a, R2_SAFETY_LIMITS.classA);
  const classB = counter(ledger.class_b, R2_SAFETY_LIMITS.classB);
  const storage = counter(ledger.stored_bytes, R2_SAFETY_LIMITS.storage);
  return {
    periodStartedAt: ledger.period_start,
    periodEndsAt: periodEndsAt.toISOString(),
    level: usageLevel(Math.max(classA.ratio, classB.ratio, storage.ratio)),
    classA,
    classB,
    storage,
  };
}
