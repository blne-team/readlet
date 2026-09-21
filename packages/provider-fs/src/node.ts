import { createReadStream, createWriteStream, type Stats } from "node:fs";
import {
  copyFile,
  link,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  type ByteRange,
  clampRange,
  contentTypeFor,
  normaliseEtag,
  publishContribution,
  type StorageAdmin,
  type StoredContent,
  type StoredObject,
  type WritableStorage,
} from "@readlet/core";
import type { FsConfig } from "./manifest.js";

type Config = FsConfig & { projectRoot?: string };

function rootOf(config: Config): string {
  return path.resolve(config.projectRoot ?? process.cwd(), config.directory);
}

/**
 * A key resolved to a path inside the library, or null if it would escape.
 *
 * Keys reach this provider from URLs, so this is a security boundary rather
 * than a tidiness check: `../../etc/passwd` must not resolve, and neither must
 * an absolute key, which `path.resolve` would otherwise honour outright.
 */
function resolveKey(root: string, key: string): string | null {
  if (key.includes("\0")) return null;

  const target = path.resolve(root, key);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!target.startsWith(prefix)) return null;

  return target;
}

/**
 * A filesystem records no entity tag, so one is derived from the size and
 * modification time. That changes exactly when the bytes are replaced, which is
 * all a validator has to promise.
 */
function describe(key: string, stats: Stats): StoredObject {
  return {
    key,
    size: stats.size,
    etag: `"${stats.ino.toString(16)}-${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`,
    uploadedAt: stats.mtime,
    // Nowhere to store a content type, so it comes from the key. The shared
    // table means this lands on the same answer an uploading provider recorded.
    contentType: contentTypeFor(key),
  };
}

/**
 * Whether a failure means the object is not there, as opposed to not readable.
 *
 * The distinction is the provider's to make, because it is the only thing here
 * that knows what `EACCES` means. Reporting an unreadable file as an absent one
 * would have the app say a library is empty when it is a permissions problem, or
 * a chapter is missing when the disk is failing — and the app's whole answer to
 * an unreachable library depends on being told that is what happened.
 */
function missing(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return (
    code === "ENOENT" ||
    // A path component that is not a directory, a name no filesystem could
    // hold, or a directory where an object was expected: all of them are
    // "there is no such object", not "it could not be read".
    code === "ENOTDIR" ||
    code === "ENAMETOOLONG" ||
    code === "EISDIR"
  );
}

/** Stats for a key, or null when it is missing or is not a file. */
async function statFile(file: string): Promise<Stats | null> {
  try {
    const stats = await stat(file);
    return stats.isFile() ? stats : null;
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}

class FsStorage implements WritableStorage {
  constructor(private readonly root: string) {}

  async head(key: string): Promise<StoredObject | null> {
    const file = resolveKey(this.root, key);
    if (!file) return null;

    const stats = await statFile(file);
    return stats ? describe(key, stats) : null;
  }

  async read(
    key: string,
    options?: { ifNoneMatch?: string; range?: ByteRange },
  ): Promise<StoredContent | null> {
    const file = resolveKey(this.root, key);
    if (!file) return null;

    const stats = await statFile(file);
    if (!stats) return null;

    const object = describe(key, stats);
    if (
      options?.ifNoneMatch &&
      normaliseEtag(options.ifNoneMatch) === normaliseEtag(object.etag)
    ) {
      // Matched, so the body is never opened — the caller answers 304.
      return { object, body: null };
    }

    const range = options?.range
      ? clampRange(options.range, stats.size)
      : undefined;
    // Asked for bytes this file does not have. No body, so the caller answers
    // 416 rather than streaming zero bytes as though they were the range.
    if (options?.range && !range) return { object, body: null };

    return {
      object,
      body: Readable.toWeb(
        // `end` is inclusive, as it is in a `Content-Range`.
        range
          ? createReadStream(file, {
              start: range.offset,
              end: range.offset + range.length - 1,
            })
          : createReadStream(file),
      ) as ReadableStream<Uint8Array>,
      ...(range ? { range } : {}),
    };
  }

  async readBytes(key: string): Promise<Uint8Array<ArrayBuffer> | null> {
    const file = resolveKey(this.root, key);
    if (!file) return null;

    try {
      const buffer = await readFile(file);
      return new Uint8Array(
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ),
      );
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async readRange(
    key: string,
    offset: number,
    length: number,
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    if (length <= 0) return null;

    const file = resolveKey(this.root, key);
    if (!file) return null;

    const stats = await statFile(file);
    if (!stats || offset >= stats.size) return null;

    // Clamped rather than refused, so an over-read behaves as it does against
    // object storage, which is what the ZIP reader relies on.
    const size = Math.min(length, stats.size - offset);
    const handle = await open(file, "r");
    try {
      const buffer = new Uint8Array(size);
      const { bytesRead } = await handle.read(buffer, 0, size, offset);
      return bytesRead === size ? buffer : buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async write(key: string, bytes: Uint8Array): Promise<void> {
    const file = resolveKey(this.root, key);
    if (!file) throw new Error(`key escapes the library: ${key}`);

    await mkdir(path.dirname(file), { recursive: true });
    // Written beside the target and renamed, so a process that dies midway
    // leaves the previous version intact rather than a truncated one. These
    // are the only files the app owns, and losing them loses bookmarks.
    const temporary = `${file}.${process.pid.toString(36)}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, file);
  }

  async putStream(
    key: string,
    body: ReadableStream<Uint8Array>,
    _size: number,
    _contentType: string,
  ): Promise<void> {
    const file = resolveKey(this.root, key);
    if (!file) throw new Error(`key escapes the library: ${key}`);
    await mkdir(path.dirname(file), { recursive: true });
    await pipeline(Readable.fromWeb(body as never), createWriteStream(file));
  }

  async writeIf(
    key: string,
    bytes: Uint8Array,
    expectedEtag: string | null,
  ): Promise<boolean> {
    const file = resolveKey(this.root, key);
    if (!file) throw new Error(`key escapes the library: ${key}`);
    await mkdir(path.dirname(file), { recursive: true });
    const lock = `${file}.lock`;
    let acquired = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        await mkdir(lock);
        acquired = true;
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== "EEXIST") throw error;
        // A process that died while writing cannot keep the state locked forever.
        const held = await stat(lock).catch(() => null);
        if (held && Date.now() - held.mtimeMs > 30_000) {
          await rmdir(lock).catch(() => {});
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    if (!acquired) throw new Error(`reader state is busy: ${key}`);
    try {
      const stats = await statFile(file);
      const actual = stats ? describe(key, stats).etag : null;
      if (actual !== expectedEtag) return false;
      await this.write(key, bytes);
      return true;
    } finally {
      await rmdir(lock);
    }
  }

  async remove(key: string): Promise<void> {
    const file = resolveKey(this.root, key);
    if (!file) return;

    await rm(file, { force: true });
    await pruneEmpty(this.root, file);
  }
}

/** The library as the app reads it: a directory it can open files in. */
export function createStorage(config: Config): WritableStorage {
  return new FsStorage(rootOf(config));
}

/**
 * Removes a directory left empty by a deletion, and its parents, up to but
 * never including the library root. Without this, deleting a book would leave
 * its folder behind for good.
 */
async function pruneEmpty(root: string, from: string): Promise<void> {
  let directory = path.dirname(from);

  while (directory.startsWith(root) && directory !== root) {
    try {
      await rmdir(directory);
    } catch {
      return;
    }
    directory = path.dirname(directory);
  }
}

/**
 * The library as the sync CLI manages it.
 *
 * Files are placed directly; the shared contribution publisher owns the
 * catalog mutation and stale-object cleanup.
 */
export function createAdmin(config: Config): StorageAdmin {
  const root = rootOf(config);
  const storage = new FsStorage(root);

  function pathFor(key: string): string {
    const file = resolveKey(root, key);
    if (!file) throw new Error(`key escapes the library: ${key}`);
    return file;
  }

  return {
    name: `filesystem → ${root}`,

    async read(key) {
      try {
        return await readFile(pathFor(key));
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },

    async put(key, file) {
      const target = pathFor(key);
      await mkdir(path.dirname(target), { recursive: true });
      await rm(target, { force: true });

      // Hard-linked where the filesystem allows it, so publishing a 40 MB book
      // to a local destination costs an inode rather than 40 MB.
      try {
        await link(file, target);
      } catch {
        await copyFile(file, target);
      }
    },

    async publish(catalog) {
      return publishContribution(storage, catalog);
    },
  };
}
