#!/usr/bin/env node
import { mkdir, mkdtemp, readdir, rename, rm, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeBooks } from "@readlet/fixtures";
import { buildLibrary } from "../packages/sync/dist/lib/build.js";
import { loadConfig } from "../packages/sync/dist/lib/config.js";

/** Populate only an empty filesystem library used by dev:no-auth. */
async function main() {
  const config = await loadConfig();
  const directory = path.resolve(
    config.root,
    process.env.READLET_DIRECTORY ?? config.storage.directory ?? "shelf-data",
  );

  try {
    if ((await readdir(directory)).length > 0) {
      console.log(`Keeping existing local library at ${directory}`);
      return;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const input = await mkdtemp(path.join(os.tmpdir(), "readlet-dev-books-"));
  await mkdir(path.dirname(directory), { recursive: true });
  const staging = await mkdtemp(
    path.join(path.dirname(directory), ".readlet-dev-library-"),
  );
  try {
    await writeBooks(input);
    const result = await buildLibrary(
      input,
      path.join(staging, "library"),
      {
        height: config.coverHeight,
      },
      null,
      () => {},
    );
    if (result.failed || result.books.length === 0) {
      throw new Error("Could not prepare the local development books.");
    }

    // Rename the complete catalog and its files together, so startup never
    // observes a partially built shelf. An existing nonempty shelf is left alone.
    try {
      await rmdir(directory);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rename(path.join(staging, "library"), directory);
    console.log(
      `Added ${result.books.length} local development books to ${directory}`,
    );
  } finally {
    await Promise.all([
      rm(input, { recursive: true, force: true }),
      rm(staging, { recursive: true, force: true }),
    ]);
  }
}

await main();
