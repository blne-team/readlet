import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { StorageAdmin } from "@readlet/core";
import type { R2UsageReservation } from "./budget.js";
import { resolveConfig } from "./config.js";
import type { R2Config } from "./manifest.js";

/**
 * Wrangler colours its output. Built from a char code rather than written as an
 * escape in the literal, which reads as a stray control character.
 */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

type Output = { stdout: Buffer; stderr: Buffer };

const wranglerBin = path.join(
  import.meta.dirname,
  "..",
  "node_modules",
  ".bin",
  "wrangler",
);

function exec(args: string[], cwd: string): Promise<Output> {
  return new Promise((resolve, reject) => {
    execFile(
      wranglerBin,
      args,
      { cwd, maxBuffer: 1024 * 1024 * 256, encoding: "buffer" },
      (error, stdout, stderr) => {
        if (error) {
          Object.assign(error, { stdout, stderr });
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      },
    );
  });
}

/** The last couple of lines wrangler wrote to stderr, which say what went wrong. */
function detail(error: unknown): string {
  const stderr = (error as { stderr?: Buffer | string }).stderr;
  return String(stderr ?? "")
    .split("\n")
    .map((line) => line.replace(ANSI, "").trim())
    .filter((line) => line && !line.startsWith("▲"))
    .slice(-2)
    .join(" ");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for remote R2 sync.`);
  return value;
}

function budgetClient(url: string) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:") {
    throw new Error("storage.budgetUrl must use HTTPS.");
  }
  const syncSecret = requiredEnvironment("READLET_SYNC_SECRET");
  const accessClientId = requiredEnvironment("READLET_SYNC_ACCESS_CLIENT_ID");
  const accessClientSecret = requiredEnvironment(
    "READLET_SYNC_ACCESS_CLIENT_SECRET",
  );

  return async (usage: R2UsageReservation): Promise<void> => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${syncSecret}`,
        "cf-access-client-id": accessClientId,
        "cf-access-client-secret": accessClientSecret,
        "content-type": "application/json",
      },
      body: JSON.stringify(usage),
    });
    if (response.ok) return;

    const body = await response.text();
    throw new Error(
      `R2 usage endpoint returned ${response.status}${body ? `: ${body}` : "."}`,
    );
  };
}

/**
 * Cloudflare R2 as the sync CLI writes it, through the wrangler executable —
 * already a dependency, and it reuses whatever login wrangler has. Each paid
 * operation is first reserved through the deployed Worker's shared ledger.
 *
 * Note what it cannot do: wrangler exposes only get, put and delete for
 * objects, with no way to enumerate a bucket. This admin therefore leaves
 * `list` and `removeAll` undefined, and the sync falls back to working out the
 * previous contents from the catalog it published last time.
 */
export async function createAdmin(
  config: R2Config & { projectRoot?: string },
): Promise<StorageAdmin> {
  const {
    bucket,
    jurisdiction,
    cwd,
    warnings,
    budgetUrl,
    local = false,
  } = await resolveConfig(config);
  const scope = local ? "--local" : "--remote";
  const base = jurisdiction && !local ? ["-J", jurisdiction] : [];
  if (!local && !budgetUrl) {
    throw new Error("storage.budgetUrl is required for remote R2 sync.");
  }
  let reserve: (usage: R2UsageReservation) => Promise<void>;
  if (local) {
    reserve = () => Promise.resolve();
  } else {
    reserve = budgetClient(budgetUrl);
  }

  async function wrangler(args: string[]): Promise<Output> {
    try {
      return await exec(args, cwd);
    } catch (error) {
      // execFile reports only "Command failed"; wrangler says what went wrong
      // on stderr, and that is the part worth seeing.
      throw new Error(detail(error) || (error as Error).message);
    }
  }

  return {
    warnings,

    name: `wrangler → ${bucket}${jurisdiction ? ` (${jurisdiction})` : ""}${local ? " [local]" : ""}`,

    // Every local invocation boots a miniflare runtime that takes an exclusive
    // lock on the shared state file, so parallel writes fail with SQLITE_BUSY.
    // Remote writes are plain HTTP and parallelise, though each still pays for
    // a wrangler start, so the useful ceiling is low.
    concurrency: local ? 1 : 4,

    async create() {
      // The local bucket is whatever miniflare makes on first write.
      if (local) return false;

      try {
        await wrangler(["r2", "bucket", "create", bucket, ...base]);
        return true;
      } catch (error) {
        if (/already exists|already owned/i.test((error as Error).message)) {
          return false;
        }
        throw error;
      }
    },

    async read(key) {
      await reserve({ classB: 1 });
      try {
        const { stdout } = await wrangler([
          "r2",
          "object",
          "get",
          `${bucket}/${key}`,
          "--pipe",
          scope,
          ...base,
        ]);
        return stdout?.length ? stdout : null;
      } catch {
        // Missing objects and auth failures look the same here; the caller
        // treats "nothing there" as an empty previous state.
        return null;
      }
    },

    async put(key, file, contentType) {
      const fileInfo = await stat(file);
      await reserve({
        classA: 1,
        objects: [{ key, bytes: fileInfo.size }],
      });
      await wrangler([
        "r2",
        "object",
        "put",
        `${bucket}/${key}`,
        "--file",
        file,
        "--content-type",
        contentType,
        scope,
        ...base,
      ]);
    },

    async remove(key) {
      await wrangler([
        "r2",
        "object",
        "delete",
        `${bucket}/${key}`,
        scope,
        ...base,
      ]);
    },
  };
}
