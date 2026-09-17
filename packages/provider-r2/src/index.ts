/**
 * The provider's own description. Kept free of any runtime-specific import, so
 * that reading it — to list providers, or to generate their documentation —
 * costs nothing and works anywhere.
 *
 * The two working halves are separate entry points:
 *
 *   @readlet/provider-r2/worker   Storage, over an R2 binding
 *   @readlet/provider-r2/node     StorageAdmin, over the wrangler CLI
 */

export type {
  R2UsageBudget,
  R2UsageCounter,
  R2UsageLevel,
  R2UsageReservation,
  R2UsageStatus,
} from "./budget.js";
export { R2UsageLimitError } from "./budget.js";

export type { R2Config } from "./manifest.js";
export { manifest } from "./manifest.js";
