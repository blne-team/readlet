import type { ProviderManifest } from "@readlet/core";

/**
 * Cloudflare R2, reached two different ways: the app reads through a Worker
 * binding, while the CLI reserves through that Worker before writing through
 * wrangler. Same bucket, two transports, because a Worker cannot spawn a
 * process and Node has no binding.
 */
export const manifest: ProviderManifest = {
  id: "r2",
  title: "Cloudflare R2",
  summary:
    "Reads through a Worker binding and publishes through the wrangler CLI, " +
    "with both paths guarded by one usage budget.",
  capabilities: {
    create: true,
    list: false,
    removeAll: false,
  },
  options: [
    {
      key: "bucket",
      required: true,
      summary: "Name of the R2 bucket to publish into.",
      example: "books",
    },
    {
      key: "jurisdiction",
      required: false,
      summary: "R2 jurisdiction the bucket was created in.",
      example: "eu",
    },
    {
      key: "worker",
      required: false,
      summary:
        "Directory holding the Worker's wrangler.jsonc. wrangler runs there, " +
        "so it picks up the right account and settings.",
      example: "apps/readlet",
    },
    {
      key: "budgetUrl",
      required: true,
      summary:
        "Deployed Readlet /api/r2-usage endpoint. Remote sync reserves its R2 usage here before publishing.",
      example: "https://readlet.example.com/api/r2-usage",
    },
  ],
  notes: [
    "wrangler exposes only get, put and delete for objects — there is no way " +
      "to enumerate a bucket. This provider therefore has no list, and --force " +
      "clears what the last published catalog recorded rather than everything.",
  ],
};

/** What this provider accepts under `storage` in readlet.config.json. */
export type R2Config = {
  bucket: string;
  jurisdiction?: string;
  /** Where wrangler runs. Defaults to the process's working directory. */
  worker?: string;
  /** The deployed app endpoint that owns the account-wide R2 usage ledger. */
  budgetUrl: string;
  /** Publish to the local miniflare bucket instead of the real one. */
  local?: boolean;
};
