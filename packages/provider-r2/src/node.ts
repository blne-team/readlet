import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Catalog, StorageAdmin } from "@readlet/core";
import type { R2Config } from "./manifest.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for R2 sync.`);
  return value;
}

function syncClient(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") {
    throw new Error("storage.endpoint must use HTTPS.");
  }
  const accessHeaders = {
    "cf-access-client-id": requiredEnvironment("READLET_SYNC_ACCESS_CLIENT_ID"),
    "cf-access-client-secret": requiredEnvironment(
      "READLET_SYNC_ACCESS_CLIENT_SECRET",
    ),
  };

  return async (
    init?: RequestInit,
    allowMissing = false,
  ): Promise<Response> => {
    const response = await fetch(url, {
      ...init,
      headers: { ...accessHeaders, ...init?.headers },
    });
    if (response.ok || (allowMissing && response.status === 404))
      return response;
    const body = await response.text();
    throw new Error(
      `Readlet sync endpoint returned ${response.status}${body ? `: ${body}` : "."}`,
    );
  };
}

/** Cloudflare publishing through the deployed Worker's R2 binding. */
export async function createAdmin(
  config: R2Config & { projectRoot?: string },
): Promise<StorageAdmin> {
  const request = syncClient(config.endpoint);

  return {
    name: `Cloudflare → ${new URL(config.endpoint).host}`,
    concurrency: 4,

    async read() {
      const response = await request(undefined, true);
      return response.status === 404
        ? null
        : new Uint8Array(await response.arrayBuffer());
    },

    async put(key, file, contentType) {
      const fileInfo = await stat(file);
      await request({
        method: "PUT",
        headers: {
          "content-length": String(fileInfo.size),
          "content-type": contentType,
          "x-readlet-key": key,
        },
        body: createReadStream(file) as never,
        duplex: "half",
      } as RequestInit & { duplex: "half" });
    },

    async publish(catalog: Catalog) {
      const response = await request({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(catalog),
      });
      return ((await response.json()) as { removed: number }).removed;
    },
  };
}
