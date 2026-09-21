import {
  bookObjectKeys,
  CATALOG_FILE,
  CATALOG_VERSION,
  type Catalog,
} from "./catalog.js";
import type { WritableStorage } from "./provider.js";

export const CONTRIBUTED_BOOK_PREFIX = "sync-";

function catalogOf(value: unknown): Catalog {
  if (
    !value ||
    typeof value !== "object" ||
    (value as Catalog).version !== CATALOG_VERSION ||
    !Array.isArray((value as Catalog).books)
  ) {
    throw new Error("The catalog is malformed or uses an unsupported version.");
  }
  const catalog = value as Catalog;
  for (const book of catalog.books) bookObjectKeys(book);
  return catalog;
}

function encode(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

async function storedCatalog(
  storage: WritableStorage,
): Promise<{ catalog: Catalog; etag: string | null }> {
  const object = await storage.read(CATALOG_FILE);
  if (!object) {
    return { catalog: { version: CATALOG_VERSION, books: [] }, etag: null };
  }
  if (!object.body) throw new Error("The catalog was returned without a body.");
  return {
    catalog: catalogOf(await new Response(object.body).json()),
    etag: object.object.etag,
  };
}

/**
 * Replaces the books owned by `pnpm sync` while preserving books imported by
 * the running app. Book objects are uploaded before this is called; the
 * compare-and-swap catalog write is the single publication point.
 */
export async function publishContribution(
  storage: WritableStorage,
  value: unknown,
): Promise<number> {
  const contribution = catalogOf(value);
  if (
    contribution.books.some(
      (book) => !book.id.startsWith(CONTRIBUTED_BOOK_PREFIX),
    )
  ) {
    throw new Error(
      `Synced book ids must start with ${CONTRIBUTED_BOOK_PREFIX}.`,
    );
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await storedCatalog(storage);
    const existingContribution = current.catalog.books.filter((book) =>
      book.id.startsWith(CONTRIBUTED_BOOK_PREFIX),
    );
    const next: Catalog = {
      version: CATALOG_VERSION,
      generatedAt: new Date().toISOString(),
      books: [
        ...current.catalog.books.filter(
          (book) => !book.id.startsWith(CONTRIBUTED_BOOK_PREFIX),
        ),
        ...contribution.books,
      ].sort((left, right) => left.title.localeCompare(right.title)),
    };

    if (
      !(await storage.writeIf(
        CATALOG_FILE,
        encode(next),
        current.etag,
        "application/json",
      ))
    ) {
      continue;
    }

    const wanted = new Set(
      contribution.books.flatMap((book) => bookObjectKeys(book)),
    );
    const stale = new Set(
      existingContribution
        .flatMap((book) => bookObjectKeys(book))
        .filter((key) => !wanted.has(key)),
    );
    await Promise.all([...stale].map((key) => storage.remove(key)));
    return stale.size;
  }

  throw new Error("The catalog changed too many times while syncing.");
}
