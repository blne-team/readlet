/**
 * A cache of HTTP responses, keyed by URL.
 *
 * Named to avoid colliding with the global `Cache`, which is one possible
 * implementation rather than the contract. Fills are fire-and-forget: a
 * provider may defer them past the response. Explicit invalidation is awaited
 * because it follows a source-of-truth mutation.
 */
export interface ResponseCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): void;
  remove(key: string): Promise<void>;
}

/** Used where no cache exists — under `next dev`, or in tests. */
export class NoopCache implements ResponseCache {
  async match(): Promise<Response | undefined> {
    return undefined;
  }

  put(): void {}

  async remove(): Promise<void> {}
}
