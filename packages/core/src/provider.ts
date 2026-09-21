/**
 * The provider contract.
 *
 * A provider is a package that knows how to hold a library. Each one has two
 * faces, because the two callers run in different places and want different
 * things:
 *
 *   Storage       what the app reads at request time, in whatever runtime it
 *                 is deployed to — ranged, streaming, no enumeration. It can
 *                 also write, where the provider supports it, which is what
 *                 lets the app keep users and reading positions.
 *   StorageAdmin  what the sync CLI manages the library with, in Node —
 *                 local book uploads and an atomic catalog contribution.
 *
 * A provider package exports a manifest plus a factory for each face it
 * supports, so the app and the CLI import the same package and get the half
 * that suits them.
 */

import type { ByteRange } from "./range.js";

export type StoredObject = {
  key: string;
  size: number;
  /** Strong validator for this version, already quoted for an ETag header. */
  etag: string;
  uploadedAt: Date;
  contentType?: string;
};

export type StoredContent = {
  object: StoredObject;
  /**
   * Null when a conditional read matched and the provider skipped the body,
   * which lets the caller answer 304 without transferring anything.
   */
  body: ReadableStream<Uint8Array> | null;
  /**
   * Which bytes {@link StoredContent.body} holds, when it is not all of them.
   *
   * Set only by a provider that honoured a requested range, and absent
   * otherwise — including when a range was asked for and the provider served
   * the whole object anyway, which HTTP allows and which a provider written
   * before ranges existed does by simply ignoring the option. Callers read
   * this rather than their own request, so declining a range degrades to a
   * complete answer instead of to a 206 that misdescribes its own body.
   *
   * {@link StoredObject.size} stays the size of the whole object either way,
   * because that is what a `Content-Range` has to name.
   */
  range?: ByteRange;
};

/**
 * Everything the app needs from a provider, and nothing specific to one.
 *
 * Note there is no `list`: the catalog enumerates the library, so discovering
 * books by walking storage is not part of the request or publishing paths.
 */
export interface Storage {
  /** Metadata only. Null if the object does not exist. */
  head(key: string): Promise<StoredObject | null>;

  /**
   * Streams an object, or some of it.
   *
   * `ifNoneMatch` lets the provider skip the body when the caller already has
   * the current version. `range` asks for a slice, and is a request rather
   * than an instruction: a provider may serve the whole object instead, and
   * says which it did through {@link StoredContent.range}.
   */
  read(
    key: string,
    options?: { ifNoneMatch?: string; range?: ByteRange },
  ): Promise<StoredContent | null>;

  /** Reads a whole object into memory. For small objects: catalogs, metadata. */
  readBytes(key: string): Promise<Uint8Array<ArrayBuffer> | null>;

  /**
   * Reads a byte range. This is what makes it possible to pull one chapter out
   * of a 42 MB archive without transferring the archive.
   */
  readRange(
    key: string,
    offset: number,
    length: number,
  ): Promise<Uint8Array<ArrayBuffer> | null>;

  /**
   * Stores a small object. Optional, because a provider may front a
   * genuinely read-only destination — a mounted archive, someone else's
   * bucket — and the alternative to optionality is a provider that lies.
   *
   * For state the app owns, not for publishing: the sync tool writes books
   * through {@link StorageAdmin}, which streams them from disk instead of
   * holding them in memory.
   */
  write?(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;

  /** Compare-and-swap for small app-owned state. Null expects no object. */
  writeIf?(
    key: string,
    bytes: Uint8Array,
    expectedEtag: string | null,
    contentType?: string,
  ): Promise<boolean>;

  /** Deletes one object. Optional alongside {@link Storage.write}. */
  remove?(key: string): Promise<void>;

  /** Streams a published book without buffering it in the application. */
  putStream?(
    key: string,
    body: ReadableStream<Uint8Array>,
    size: number,
    contentType: string,
  ): Promise<void>;
}

/** A {@link Storage} with conflict-safe writes and deletion. */
export interface WritableStorage extends Storage {
  write(key: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  writeIf(
    key: string,
    bytes: Uint8Array,
    expectedEtag: string | null,
    contentType?: string,
  ): Promise<boolean>;
  remove(key: string): Promise<void>;
}

/**
 * The same storage, narrowed, or null where the provider cannot write.
 *
 * Callers branch on the result rather than calling and catching, so a
 * read-only library degrades to a working shelf with no saved positions
 * instead of to an error at the moment someone turns a page.
 */
export function writableStorage(storage: Storage): WritableStorage | null {
  return typeof storage.write === "function" &&
    typeof storage.writeIf === "function" &&
    typeof storage.remove === "function"
    ? (storage as WritableStorage)
    : null;
}

/**
 * Everything the sync CLI needs to publish and maintain a library. Runs in
 * Node, so `put` takes a path on disk rather than bytes — a provider streams a
 * 40 MB book from the filesystem rather than holding it in memory.
 *
 * Providers upload book objects and atomically publish a catalog contribution.
 */
export interface StorageAdmin {
  /** Shown to the user before anything is written. */
  readonly name: string;

  /** Safe parallel writes. Defaults to 4 where a provider states nothing. */
  readonly concurrency?: number;

  /**
   * Anything the user should know before this publishes. Surfaced by the CLI
   * before it writes, rather than logged from inside the provider.
   */
  readonly warnings?: readonly string[];

  /** Reads a whole object. Null when it is not there. */
  read(key: string): Promise<Uint8Array | null>;

  /** Uploads a local file to a key. */
  put(key: string, file: string, contentType: string): Promise<void>;

  /** Publishes one complete sync contribution and returns removed objects. */
  publish(catalog: import("./catalog.js").Catalog): Promise<number>;
}

/**
 * The same storage with the write path taken off.
 *
 * Deliberately a wrapper that does not carry `write` or `remove` at all,
 * rather than ones that throw: {@link writableStorage} decides by asking
 * whether the methods are there, so everything downstream already knows how
 * to behave against storage it cannot write to. A deployment that refuses
 * edits and a provider that cannot make them are the same situation, and the
 * app should not need to tell them apart.
 */
export function readOnlyStorage(storage: Storage): Storage {
  return {
    head: (key) => storage.head(key),
    read: (key, options) => storage.read(key, options),
    readBytes: (key) => storage.readBytes(key),
    readRange: (key, offset, length) => storage.readRange(key, offset, length),
  };
}

/** One key a provider accepts under `storage` in readlet.config.json. */
export type ProviderOption = {
  key: string;
  required: boolean;
  summary: string;
  example?: string;
};

/**
 * What a provider says about itself. Static, so it can be read without
 * credentials — which is what lets the CLI list providers, and the docs
 * describe them, without connecting to anything.
 */
export type ProviderManifest = {
  /** Used in config and on the command line, e.g. `r2`. */
  id: string;
  title: string;
  summary: string;
  options: ProviderOption[];
  /** Anything a user should know before choosing it. */
  notes?: string[];
};
