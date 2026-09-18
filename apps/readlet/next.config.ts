import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { findConfigSync } from "@readlet/core/config";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/headers";

/**
 * Which provider holds the library is decided here, at build time, from the
 * same readlet.config.json the sync tool publishes through — so the two
 * cannot disagree about where the books are.
 *
 * It has to be build time rather than request time: on Workers there is no
 * filesystem to read a config file from, and the two modes are different
 * artifacts anyway — one Worker, one Node server. The values below are baked
 * into the bundle as defaults; READLET_PROVIDER and READLET_DIRECTORY still
 * override them at run time, for a deployment whose library sits somewhere
 * other than where it was built.
 */
function providerDefaults(): Record<string, string> {
  const found = findConfigSync(process.cwd());
  const storage = found?.config.storage ?? {};
  const directory = storage.directory;
  const localFilesystem =
    process.env.NODE_ENV === "development" &&
    process.env.READLET_PROVIDER === "fs";

  return {
    READLET_PROVIDER_DEFAULT: String(storage.provider ?? "r2"),
    ...(found && typeof directory === "string"
      ? {
          READLET_DIRECTORY_DEFAULT: path.resolve(found.root, directory),
        }
      : localFilesystem
        ? {
            READLET_DIRECTORY_DEFAULT: path.resolve(
              found?.root ?? process.cwd(),
              "shelf-data",
            ),
          }
        : {}),
  };
}

const nextConfig: NextConfig = {
  env: providerDefaults(),

  headers: securityHeaders,
};

// Makes the Cloudflare bindings (R2, etc.) available to `next dev`. Loading
// the development proxy during a production build makes it inspect the
// pre-OpenNext worker, before Readlet's Durable Object export is bundled.
if (
  process.env.NODE_ENV === "development" &&
  (process.env.READLET_PROVIDER ?? nextConfig.env?.READLET_PROVIDER_DEFAULT) ===
    "r2"
) {
  initOpenNextCloudflareForDev();
}

export default nextConfig;
