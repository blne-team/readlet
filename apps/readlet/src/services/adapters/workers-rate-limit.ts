import type { RateLimits } from "@/services/ports/limits";

/**
 * Asks one limiter about one visitor. The whole of the binding's contract, in
 * one place, so the two allowances below cannot drift apart.
 *
 * Binding failures are surfaced; they are not permission to bypass the quota.
 */
export async function checkRateLimit(
  limiter: RateLimit,
  key: string,
): Promise<boolean> {
  const { success } = await limiter.limit({ key });
  return success;
}

/**
 * Cloudflare's rate limiting bindings, one per allowance.
 *
 * Two bindings rather than one counted twice, because they are two questions
 * with two different answers: how much of the bucket a visitor may touch at
 * all, and how many whole books they may carry off. The periods and limits live
 * in wrangler.jsonc, where the deployment can change them without a build.
 */
export class WorkersRateLimits implements RateLimits {
  private readonly r2: RateLimit;
  private readonly download: RateLimit;

  constructor(r2: RateLimit, download: RateLimit) {
    this.r2 = r2;
    this.download = download;
  }

  allowsR2(visitor: string): Promise<boolean> {
    return checkRateLimit(this.r2, visitor);
  }

  allowsDownload(visitor: string): Promise<boolean> {
    return checkRateLimit(this.download, visitor);
  }
}

/**
 * The limiters the Worker was given, or null where it has none.
 *
 * Both or neither. A half-configured deployment is an error.
 */
export function workersRateLimits(env: CloudflareEnv): RateLimits | null {
  if (!!env.R2_RATE_LIMITER !== !!env.DOWNLOAD_RATE_LIMITER) {
    throw new Error("The Worker must configure both rate limiting bindings.");
  }
  if (!env.R2_RATE_LIMITER || !env.DOWNLOAD_RATE_LIMITER) return null;
  return new WorkersRateLimits(env.R2_RATE_LIMITER, env.DOWNLOAD_RATE_LIMITER);
}
