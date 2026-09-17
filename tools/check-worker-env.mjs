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
  "READLET_SYNC_SECRET",
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
