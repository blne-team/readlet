#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

// OpenNext packages values from both the app and monorepo-root .env files into
// the Worker. Wrangler authentication belongs in the shell or .wrangler-auth,
// never in those files.
const compiled = readFileSync(
  path.resolve(".open-next/cloudflare/next-env.mjs"),
  "utf8",
);
const forbiddenBuildValues = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CF_API_TOKEN",
  "CF_API_KEY",
  "READLET_SYNC_ACCESS_CLIENT_ID",
  "READLET_SYNC_ACCESS_CLIENT_SECRET",
];
const included = forbiddenBuildValues.filter((name) =>
  compiled.includes(`"${name}":`),
);

if (included.length) {
  throw new Error(
    `Worker bundle contains deployment or sync credentials: ${included.join(", ")}. ` +
      "Move them out of .env files before deploying.",
  );
}

// BOOKS is selected in the Cloudflare dashboard because its bucket name is
// deployment-specific. Every source-driven deployment must preserve that
// binding or a routine push would disconnect an installed library.
const wrangler = readFileSync(path.resolve("wrangler.jsonc"), "utf8");
const keptBindings = wrangler.match(
  /"keep_bindings"\s*:\s*\[([\s\S]*?)\]/,
)?.[1];
if (!keptBindings?.includes('"r2_bucket"')) {
  throw new Error(
    "wrangler.jsonc must preserve r2_bucket bindings so deployments keep the dashboard-managed BOOKS bucket.",
  );
}
