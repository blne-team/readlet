import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  CATALOG_FILE,
  type Catalog,
  contentTypeFor,
  type StorageAdmin,
} from "@readlet/core";
import { messageOf, pool, retry } from "./util.js";

/** One file in the built tree, and where it is going. */
type Upload = { key: string; file: string; contentType: string };

/** What a publish did. */
export type SyncResult = {
  uploaded: number;
  removed: number;
  failed: number;
};

export type SyncOptions = {
  log: (message: string) => void;
};

/** Used when a provider does not state its own safe write concurrency. */
const DEFAULT_CONCURRENCY = 4;

/** Every file in the built tree, as the keys they will occupy. */
async function localKeys(outDir: string): Promise<Upload[]> {
  const entries = await readdir(outDir, {
    withFileTypes: true,
    recursive: true,
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name !== CATALOG_FILE)
    .map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return {
        key: path.relative(outDir, file).split(path.sep).join("/"),
        file,
        contentType: contentTypeFor(entry.name),
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Uploads every book object, publishes the contribution as one final catalog
 * mutation, then lets the provider remove objects from the previous
 * contribution. Books created by the running app are never part of that set.
 */
export async function syncLibrary(
  admin: StorageAdmin,
  outDir: string,
  { log }: SyncOptions,
): Promise<SyncResult> {
  const concurrency = admin.concurrency ?? DEFAULT_CONCURRENCY;
  const desired = await localKeys(outDir);
  const catalog = JSON.parse(
    await readFile(path.join(outDir, CATALOG_FILE), "utf8"),
  ) as Catalog;

  log(`Uploading ${desired.length} objects to ${admin.name}…`);
  let done = 0;
  let failed = 0;

  await pool(desired, concurrency, async (entry) => {
    try {
      await retry(() => admin.put(entry.key, entry.file, entry.contentType));
      done++;
      if (done % 25 === 0) log(`  ${done}/${desired.length}`);
    } catch (error) {
      failed++;
      log(`  fail   ${entry.key} (${messageOf(error).trim().split("\n")[0]})`);
    }
  });

  if (failed) {
    log("Catalog unchanged because one or more book objects failed to upload.");
    return { uploaded: done, removed: 0, failed };
  }

  const removed = await admin.publish(catalog);
  return { uploaded: done + 1, removed, failed };
}
