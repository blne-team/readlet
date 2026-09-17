import { DurableObject } from "cloudflare:workers";
import type {
  R2UsageReservation,
  R2UsageStatus,
} from "@readlet/provider-r2/worker";
import {
  billingPeriod,
  R2_SAFETY_LIMITS,
  type R2LedgerState,
  r2UsageStatus,
} from "@/services/r2-usage-policy";

type LedgerEnv = CloudflareEnv & { READLET_R2_BILLING_DAY: string };

function nonNegativeInteger(value: unknown, name: string): number {
  if (
    value === undefined ||
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

function reservationOf(value: unknown): Required<R2UsageReservation> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The reservation must be a JSON object.");
  }
  const input = value as Record<string, unknown>;
  const objects = input.objects === undefined ? [] : input.objects;
  if (!Array.isArray(objects)) {
    throw new Error("objects must be an array.");
  }

  return {
    classA: nonNegativeInteger(input.classA ?? 0, "classA"),
    classB: nonNegativeInteger(input.classB ?? 0, "classB"),
    objects: objects.map((object, index) => {
      if (!object || typeof object !== "object" || Array.isArray(object)) {
        throw new Error(`objects[${index}] must be an object.`);
      }
      const entry = object as Record<string, unknown>;
      if (
        typeof entry.key !== "string" ||
        !entry.key ||
        entry.key.length > 1024
      ) {
        throw new Error(`objects[${index}].key must be 1 to 1024 characters.`);
      }
      return {
        key: entry.key,
        bytes: nonNegativeInteger(entry.bytes, `objects[${index}].bytes`),
      };
    }),
  };
}

/**
 * The single account ledger. Durable Object serialization plus a synchronous
 * SQLite transaction makes checking and reserving one indivisible operation.
 */
export class R2UsageLedger extends DurableObject<LedgerEnv> {
  constructor(ctx: DurableObjectState, env: LedgerEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        period_start TEXT NOT NULL,
        class_a INTEGER NOT NULL,
        class_b INTEGER NOT NULL,
        stored_bytes INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS objects (
        key TEXT PRIMARY KEY,
        bytes INTEGER NOT NULL
      );
    `);
  }

  private currentLedger(now = new Date()): {
    ledger: R2LedgerState;
    periodEndsAt: Date;
  } {
    const billingDay = Number(this.env.READLET_R2_BILLING_DAY);
    const { startedAt, endsAt } = billingPeriod(now, billingDay);
    const periodStart = startedAt.toISOString();
    const existing = this.ctx.storage.sql
      .exec<R2LedgerState>(
        "SELECT period_start, class_a, class_b, stored_bytes FROM usage WHERE id = 1",
      )
      .toArray()[0];

    if (existing?.period_start === periodStart) {
      return { ledger: existing, periodEndsAt: endsAt };
    }

    const storedBytes = existing?.stored_bytes ?? 0;
    this.ctx.storage.sql.exec(
      `INSERT INTO usage (id, period_start, class_a, class_b, stored_bytes)
       VALUES (1, ?, 0, 0, ?)
       ON CONFLICT(id) DO UPDATE SET
         period_start = excluded.period_start,
         class_a = 0,
         class_b = 0`,
      periodStart,
      storedBytes,
    );
    return {
      ledger: {
        period_start: periodStart,
        class_a: 0,
        class_b: 0,
        stored_bytes: storedBytes,
      },
      periodEndsAt: endsAt,
    };
  }

  private reserve(usage: Required<R2UsageReservation>): {
    accepted: boolean;
    status: R2UsageStatus;
  } {
    return this.ctx.storage.transactionSync(() => {
      const { ledger, periodEndsAt } = this.currentLedger();
      const sizes = new Map<string, number>();
      let addedBytes = 0;

      for (const object of usage.objects) {
        const prior =
          sizes.get(object.key) ??
          this.ctx.storage.sql
            .exec<{ bytes: number }>(
              "SELECT bytes FROM objects WHERE key = ?",
              object.key,
            )
            .toArray()[0]?.bytes ??
          0;
        const reserved = Math.max(prior, object.bytes);
        sizes.set(object.key, reserved);
        addedBytes += reserved - prior;
      }

      const projected: R2LedgerState = {
        period_start: ledger.period_start,
        class_a: ledger.class_a + usage.classA,
        class_b: ledger.class_b + usage.classB,
        stored_bytes: ledger.stored_bytes + addedBytes,
      };
      const status = r2UsageStatus(projected, periodEndsAt);
      if (
        projected.class_a > R2_SAFETY_LIMITS.classA ||
        projected.class_b > R2_SAFETY_LIMITS.classB ||
        projected.stored_bytes > R2_SAFETY_LIMITS.storage
      ) {
        return { accepted: false, status };
      }

      this.ctx.storage.sql.exec(
        `UPDATE usage
         SET class_a = ?, class_b = ?, stored_bytes = ?
         WHERE id = 1`,
        projected.class_a,
        projected.class_b,
        projected.stored_bytes,
      );
      for (const [key, bytes] of sizes) {
        this.ctx.storage.sql.exec(
          `INSERT INTO objects (key, bytes) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET bytes = MAX(bytes, excluded.bytes)`,
          key,
          bytes,
        );
      }
      return { accepted: true, status };
    });
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const headers = { "cache-control": "no-store" };

    if (request.method === "GET" && path === "/status") {
      const { ledger, periodEndsAt } = this.currentLedger();
      return Response.json(r2UsageStatus(ledger, periodEndsAt), { headers });
    }

    if (request.method === "POST" && path === "/reserve") {
      let usage: Required<R2UsageReservation>;
      try {
        usage = reservationOf(await request.json());
      } catch (error) {
        return Response.json(
          { error: (error as Error).message },
          { status: 400, headers },
        );
      }

      const result = this.reserve(usage);
      return result.accepted
        ? Response.json(result.status, { headers })
        : Response.json(
            {
              error: "The R2 safety limit has been reached.",
              status: result.status,
            },
            { status: 503, headers },
          );
    }

    return Response.json({ error: "Not found." }, { status: 404, headers });
  }
}
