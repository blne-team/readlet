import {
  type ByteRange,
  clampRange,
  normaliseEtag,
  type StoredContent,
  type StoredObject,
  type WritableStorage,
} from "@readlet/core";
import {
  type R2UsageBudget,
  R2UsageLimitError,
  type R2UsageReservation,
  type R2UsageStatus,
} from "./budget.js";

export type {
  R2UsageBudget,
  R2UsageCounter,
  R2UsageLevel,
  R2UsageReservation,
  R2UsageStatus,
} from "./budget.js";
export { R2UsageLimitError } from "./budget.js";

/**
 * The shape of the R2 binding, structurally rather than by importing the
 * Cloudflare runtime types. A provider package should not drag a second copy of
 * workerd's global declarations into whatever consumes it, and this states
 * exactly which slice of R2 the app depends on.
 */
export type R2ObjectLike = {
  key: string;
  size: number;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
};

export type R2GetOptionsLike = {
  range?: { offset: number; length: number };
  onlyIf?: { etagDoesNotMatch: string };
};

export type R2PutOptionsLike = {
  httpMetadata?: { contentType?: string };
  onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string };
};

export type R2BucketLike = {
  head(key: string): Promise<R2ObjectLike | null>;
  get(
    key: string,
    options?: R2GetOptionsLike,
  ): Promise<
    | (R2ObjectLike & {
        body?: ReadableStream<Uint8Array>;
        arrayBuffer(): Promise<ArrayBuffer>;
      })
    | null
  >;
  put(
    key: string,
    value: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView,
    options?: R2PutOptionsLike,
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
};

function describe(object: R2ObjectLike): StoredObject {
  return {
    key: object.key,
    size: object.size,
    etag: object.httpEtag,
    uploadedAt: object.uploaded,
    contentType: object.httpMetadata?.contentType,
  };
}

class R2Storage implements WritableStorage {
  constructor(
    private readonly bucket: R2BucketLike,
    private readonly budget: R2UsageBudget,
  ) {}

  async head(key: string): Promise<StoredObject | null> {
    await this.budget.reserve({ classB: 1 });
    const object = await this.bucket.head(key);
    return object ? describe(object) : null;
  }

  async read(
    key: string,
    options?: { ifNoneMatch?: string; range?: ByteRange },
  ): Promise<StoredContent | null> {
    const range =
      options?.range && options.range.length > 0 ? options.range : undefined;

    // A plain conditional object rather than the request's `Headers`: a Headers
    // instance cannot cross the RPC boundary of the binding proxy that
    // `next dev` runs behind.
    const conditional = options?.ifNoneMatch
      ? { onlyIf: { etagDoesNotMatch: normaliseEtag(options.ifNoneMatch) } }
      : undefined;

    await this.budget.reserve({ classB: 1 });
    const object = await this.bucket.get(
      key,
      range ? { ...conditional, range } : conditional,
    );
    if (!object) return null;

    const described = describe(object);

    // What came back may be shorter than what was asked for, and the caller has
    // to describe the bytes it actually has rather than the ones it wanted.
    // `size` stays the whole object's, which is what a `Content-Range` names.
    const served = range ? clampRange(range, described.size) : undefined;
    // Asked for bytes this object does not have. No body, so the caller answers
    // 416 rather than passing on whatever R2 made of an impossible range.
    if (range && !served) return { object: described, body: null };

    return {
      object: described,
      // R2 omits the body when the precondition matched.
      body: object.body ?? null,
      ...(served ? { range: served } : {}),
    };
  }

  async readBytes(key: string): Promise<Uint8Array<ArrayBuffer> | null> {
    await this.budget.reserve({ classB: 1 });
    const object = await this.bucket.get(key);
    if (!object) return null;
    return new Uint8Array(await object.arrayBuffer());
  }

  async readRange(
    key: string,
    offset: number,
    length: number,
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    if (length <= 0) return null;
    await this.budget.reserve({ classB: 1 });
    const object = await this.bucket.get(key, { range: { offset, length } });
    if (!object) return null;
    return new Uint8Array(await object.arrayBuffer());
  }

  async write(
    key: string,
    bytes: Uint8Array,
    contentType?: string,
  ): Promise<void> {
    await this.budget.reserve({
      classA: 1,
      objects: [{ key, bytes: bytes.byteLength }],
    });
    await this.bucket.put(
      key,
      bytes,
      contentType ? { httpMetadata: { contentType } } : undefined,
    );
  }

  async putStream(
    key: string,
    body: ReadableStream<Uint8Array>,
    size: number,
    contentType: string,
  ): Promise<void> {
    await this.budget.reserve({
      classA: 1,
      objects: [{ key, bytes: size }],
    });
    // R2 refuses a generic ReadableStream, including one produced by the
    // importer's size-checking TransformStream. Its Worker binding needs a
    // stream whose length is known before it starts consuming it.
    const FixedLength = (
      globalThis as typeof globalThis & {
        FixedLengthStream?: new (
          length: number,
        ) => {
          readable: ReadableStream<Uint8Array>;
          writable: WritableStream<Uint8Array>;
        };
      }
    ).FixedLengthStream;
    if (FixedLength) {
      const fixed = new FixedLength(size);
      await Promise.all([
        body.pipeTo(fixed.writable),
        this.bucket.put(key, fixed.readable, { httpMetadata: { contentType } }),
      ]);
      return;
    }

    // The local Next.js development proxy runs this adapter in Node, where
    // FixedLengthStream does not exist. Pass bytes to its R2 binding instead.
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    if (bytes.byteLength !== size)
      throw new Error("The uploaded file was incomplete.");
    await this.bucket.put(key, bytes, { httpMetadata: { contentType } });
  }

  async writeIf(
    key: string,
    bytes: Uint8Array,
    expectedEtag: string | null,
    contentType?: string,
  ): Promise<boolean> {
    await this.budget.reserve({
      classA: 1,
      objects: [{ key, bytes: bytes.byteLength }],
    });
    const written = await this.bucket.put(key, bytes, {
      onlyIf: expectedEtag
        ? { etagMatches: normaliseEtag(expectedEtag) }
        : { etagDoesNotMatch: "*" },
      ...(contentType ? { httpMetadata: { contentType } } : {}),
    });
    return written !== null;
  }

  async remove(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}

type DurableObjectStubLike = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type R2UsageNamespaceLike = {
  getByName(name: string): DurableObjectStubLike;
};

class DurableObjectR2UsageBudget implements R2UsageBudget {
  private readonly stub: DurableObjectStubLike;

  constructor(namespace: R2UsageNamespaceLike) {
    this.stub = namespace.getByName("account");
  }

  async reserve(usage: R2UsageReservation): Promise<void> {
    const response = await this.stub.fetch(
      "https://r2-usage.internal/reserve",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(usage),
      },
    );
    if (response.ok) return;

    const result = (await response.json()) as {
      error: string;
      status?: R2UsageStatus;
    };
    throw new R2UsageLimitError(result.error, result.status);
  }

  async status(): Promise<R2UsageStatus> {
    const response = await this.stub.fetch("https://r2-usage.internal/status");
    if (!response.ok) {
      throw new Error(`R2 usage ledger returned ${response.status}.`);
    }
    return (await response.json()) as R2UsageStatus;
  }
}

export function createUsageBudget(
  namespace: R2UsageNamespaceLike,
): R2UsageBudget {
  return new DurableObjectR2UsageBudget(namespace);
}

/** Cloudflare R2 as the app reads it, guarded by the shared usage budget. */
export function createStorage(
  bucket: R2BucketLike,
  budget: R2UsageBudget,
): WritableStorage {
  return new R2Storage(bucket, budget);
}
