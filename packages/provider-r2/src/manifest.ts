import type { ProviderManifest } from "@readlet/core";

/**
 * Cloudflare R2, always reached through the deployed Worker's binding.
 */
export const manifest: ProviderManifest = {
  id: "r2",
  title: "Cloudflare R2",
  summary: "Reads and publishes through the deployed Worker's R2 binding.",
  options: [
    {
      key: "endpoint",
      required: true,
      summary:
        "The deployed Readlet /api/library/sync endpoint used for publishing.",
      example: "https://readlet.example.com/api/library/sync",
    },
  ],
};

/** What this provider accepts under `storage` in readlet.config.json. */
export type R2Config = {
  endpoint: string;
};
