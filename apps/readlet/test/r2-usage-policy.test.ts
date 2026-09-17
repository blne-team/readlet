import assert from "node:assert/strict";
import { test } from "node:test";
import {
  billingPeriod,
  R2_SAFETY_LIMITS,
  r2UsageStatus,
  usageLevel,
} from "../src/services/r2-usage-policy.ts";

test("uses the configured UTC billing day", () => {
  const before = billingPeriod(new Date("2026-09-15T23:59:59Z"), 16);
  assert.equal(before.startedAt.toISOString(), "2026-08-16T00:00:00.000Z");
  assert.equal(before.endsAt.toISOString(), "2026-09-16T00:00:00.000Z");

  const onDay = billingPeriod(new Date("2026-09-16T00:00:00Z"), 16);
  assert.equal(onDay.startedAt.toISOString(), "2026-09-16T00:00:00.000Z");
  assert.equal(onDay.endsAt.toISOString(), "2026-10-16T00:00:00.000Z");
});

test("clamps a late billing day to the end of short months", () => {
  const period = billingPeriod(new Date("2026-03-15T00:00:00Z"), 31);
  assert.equal(period.startedAt.toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(period.endsAt.toISOString(), "2026-03-31T00:00:00.000Z");
});

test("levels represent 60%, 70%, and 80% of the free tier", () => {
  assert.equal(usageLevel(0.749), "healthy");
  assert.equal(usageLevel(0.75), "warning");
  assert.equal(usageLevel(0.875), "critical");
  assert.equal(usageLevel(1), "blocked");
});

test("reports the most constrained R2 resource", () => {
  const status = r2UsageStatus(
    {
      period_start: "2026-09-01T00:00:00.000Z",
      class_a: R2_SAFETY_LIMITS.classA * 0.75,
      class_b: 1,
      stored_bytes: 1,
    },
    new Date("2026-10-01T00:00:00.000Z"),
  );

  assert.equal(status.level, "warning");
  assert.equal(status.classA.limit, 800_000);
  assert.equal(status.classB.limit, 8_000_000);
  assert.equal(status.storage.limit, 8_000_000_000);
});
