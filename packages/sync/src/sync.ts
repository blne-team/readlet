#!/usr/bin/env node
/**
 * Builds the library and publishes it to the bucket.
 *
 *   readlet-sync              build the library, then upload it
 *   readlet-sync --dry-run    build the tree, upload nothing
 *
 * Where books are read from, where the tree is built, and where it publishes to
 * all come from readlet.config.json, found by walking up from the working
 * directory. Without one, the conventional layout applies: books in ./books,
 * the upload tree in ./library.
 *
 * Each book becomes a folder holding every format of it, its cover and the
 * metadata read out of the book itself, with a catalog at the root:
 *
 *   library/
 *     essential-math-for-data-science/
 *       metadata.json
 *       cover.webp
 *       essential-math-for-data-science.epub
 *     catalog.json
 *
 * Where it publishes to is a provider package, resolved by importing it, so
 * another destination is a package rather than a change here.
 */

import { access } from "node:fs/promises";
import path from "node:path";
import { CATALOG_FILE, CATALOG_VERSION, type Catalog } from "@readlet/core";
import { syncLibrary } from "./lib/bucket.js";
import { buildLibrary } from "./lib/build.js";
import { CONFIG_FILES, DEFAULTS, loadConfig } from "./lib/config.js";
import { findThumbnailer } from "./lib/images.js";
import { BUILT_IN_IDS, createAdmin } from "./lib/providers.js";
import { messageOf } from "./lib/util.js";

type Options = {
  dryRun: boolean;
  full: boolean;
  /** Left null so the configured value shows through. */
  provider: string | null;
  height: number | null;
};

const USAGE = `usage: pnpm sync [options]

  --dry-run          build the library but publish nothing
  --provider NAME    which provider to publish through (built in: ${BUILT_IN_IDS.join(", ")};
                     anything else is imported as a package)
  --size N           cover thumbnail height in pixels
  --full             keep full-size covers instead of thumbnailing them

Directories and provider settings are read from ${CONFIG_FILES[0]}; the flags
above override it for one run.`;

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    dryRun: false,
    full: false,
    provider: null,
    height: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--provider") options.provider = argv[++i] ?? "";
    else if (arg === "--size") options.height = Number(argv[++i]);
    else if (arg === "--full") options.full = true;
    else throw new Error(`unknown option: ${arg}`);
  }

  if (
    options.height !== null &&
    (!Number.isInteger(options.height) || options.height <= 0)
  ) {
    throw new Error("--size must be a positive integer");
  }

  return options;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const log = (message: string): void => console.log(message);

async function main(): Promise<void> {
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${messageOf(error)}\n\n${USAGE}`);
    process.exit(1);
  }

  const config = await loadConfig();
  const here = (file: string) => path.relative(config.root, file) || ".";

  if (!(await exists(config.inputDir))) {
    console.error(
      `No ${here(config.inputDir)}/ directory.\n\n` +
        `Create it and put your books in it:\n  mkdir ${here(config.inputDir)}` +
        (config.configFile
          ? ""
          : `\n\nOr point somewhere else from a ${CONFIG_FILES[0]}:\n` +
            `  { "input": "${DEFAULTS.input}", "output": "${DEFAULTS.output}" }`),
    );
    process.exit(1);
  }

  // Resolved before any work, so an unknown provider or a missing setting fails
  // immediately rather than after building the whole library.
  const admin = options.dryRun
    ? null
    : await createAdmin(
        options.provider ?? config.storage.provider,
        config.storage,
      );

  for (const warning of admin?.warnings ?? []) {
    console.warn(`warning: ${warning}\n`);
  }

  const thumb = options.full ? null : await findThumbnailer();
  if (!options.full && !thumb) {
    console.error(
      "No image scaler found. Install cwebp (`apt install webp` on Debian/Ubuntu,\n" +
        "`brew install webp` on macOS), or\n" +
        "pass --full to keep full-size covers — but note those run about a\n" +
        "hundred times larger than the shelf can display.",
    );
    process.exit(1);
  }

  const published = admin ? await admin.read(CATALOG_FILE) : null;
  const previous = published
    ? (JSON.parse(new TextDecoder().decode(published)) as Catalog)
    : undefined;
  if (previous && previous.version !== CATALOG_VERSION) {
    throw new Error(
      `The published catalog uses version ${previous.version}; version ${CATALOG_VERSION} is required.`,
    );
  }

  log(`Building ${here(config.outputDir)}/ from ${here(config.inputDir)}/…`);
  const { books, failed } = await buildLibrary(
    config.inputDir,
    config.outputDir,
    { height: options.height ?? config.coverHeight, previous },
    thumb,
    log,
  );

  const withCover = books.filter((book) => book.cover).length;
  const withAuthors = books.filter((book) => book.authors.length).length;
  log(
    `\n${books.length} books built, ${failed} failed. ` +
      `${withCover} with covers, ${withAuthors} with authors.`,
  );

  if (options.dryRun) {
    log(`\nDry run: ${here(config.outputDir)}/ is ready, nothing published.`);
    return;
  }

  log("");

  // Only a dry run leaves this unresolved, and that returned above. Stated
  // rather than assumed, because the two are linked by a condition several
  // steps back and nothing else would notice if that link were broken.
  if (!admin) throw new Error("no destination to publish through");

  const result = await syncLibrary(admin, config.outputDir, {
    log,
  });

  log(
    `\nPublished ${result.uploaded} objects` +
      (result.removed ? `, removed ${result.removed}` : "") +
      (result.failed ? `, ${result.failed} failed` : "") +
      ".",
  );

  if (result.failed) process.exit(1);
}

try {
  await main();
} catch (error) {
  console.error(`\n${messageOf(error)}`);
  process.exit(1);
}
