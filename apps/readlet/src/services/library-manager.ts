import {
  type Book,
  bookObjectKeys,
  CATALOG_FILE,
  CATALOG_VERSION,
  type Catalog,
  LIBRARY_OPERATIONS_FILE,
  rangedSource,
  type Storage,
  type User,
  writableStorage,
} from "@readlet/core";
import { readEpubSource } from "@readlet/sync/epub";
import { readPdfSource } from "@readlet/sync/pdf";
import type { CatalogService } from "@/services/catalog";
import { reading, writing } from "@/services/errors";
import type { ProgressService } from "@/services/progress";
import type { ReaderMarksService } from "@/services/reader-marks";
import type { UserService } from "@/services/users";

const OPERATIONS_VERSION = 1;
const MAX_ATTEMPTS = 8;

export type PendingBookDeletion = {
  book: Book;
  requestedAt: string;
};

type LibraryOperations = {
  version: typeof OPERATIONS_VERSION;
  deletions: Record<string, PendingBookDeletion>;
};

type Stored<T> = { value: T; etag: string | null };

export class ReadOnlyLibraryError extends Error {
  constructor() {
    super("This library cannot change books because its storage is read-only.");
    this.name = "ReadOnlyLibraryError";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseCatalog(value: unknown): Catalog {
  if (
    !record(value) ||
    value.version !== CATALOG_VERSION ||
    !Array.isArray(value.books)
  ) {
    throw new Error("The catalog is malformed or uses an unsupported version.");
  }

  const books = value.books as Book[];
  const ids = new Set<string>();
  for (const book of books) {
    // This validates every key deletion could derive from the catalog.
    bookObjectKeys(book);
    if (ids.has(book.id))
      throw new Error("The catalog contains duplicate books.");
    ids.add(book.id);
  }
  return value as Catalog;
}

function parseOperations(value: unknown): LibraryOperations {
  if (
    !record(value) ||
    value.version !== OPERATIONS_VERSION ||
    !record(value.deletions)
  ) {
    throw new Error("The library operations file is malformed.");
  }

  const deletions: LibraryOperations["deletions"] = {};
  for (const [id, candidate] of Object.entries(value.deletions)) {
    if (
      !record(candidate) ||
      !record(candidate.book) ||
      candidate.book.id !== id ||
      typeof candidate.requestedAt !== "string"
    ) {
      throw new Error(
        "The library operations file contains an invalid deletion.",
      );
    }
    const book = candidate.book as Book;
    bookObjectKeys(book);
    deletions[id] = { book, requestedAt: candidate.requestedAt };
  }

  return { version: OPERATIONS_VERSION, deletions };
}

function encode(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}

function importFileName(name: string, format: "epub" | "pdf"): string {
  // A book's UUID folder keeps uploads distinct. The file inside it can keep
  // a readable version of the source name while satisfying parseBookKey's
  // single-segment ASCII filename rule.
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const stem = base
    .replace(/\.(epub|pdf)$/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 123)
    .replace(/[._-]+$/, "");
  return `${stem || "book"}.${format}`;
}

/** Manager-only mutations over the catalogued library. */
export class LibraryManagerService {
  private readonly storage: Storage;
  private readonly catalog: CatalogService;
  private readonly users: UserService;
  private readonly progress: ProgressService;
  private readonly readerMarks: ReaderMarksService;

  constructor(
    storage: Storage,
    catalog: CatalogService,
    users: UserService,
    progress: ProgressService,
    readerMarks: ReaderMarksService,
  ) {
    this.storage = storage;
    this.catalog = catalog;
    this.users = users;
    this.progress = progress;
    this.readerMarks = readerMarks;
  }

  get writable(): boolean {
    return writableStorage(this.storage) !== null;
  }

  /** Publish one EPUB or PDF; only the final catalog write exposes it. */
  async importBook(
    actor: User,
    name: string,
    body: ReadableStream<Uint8Array>,
    size: number,
  ): Promise<Book> {
    const target = writableStorage(this.storage);
    if (!target?.putStream) throw new ReadOnlyLibraryError();
    await this.users.assertManager(actor);

    const format = name.toLowerCase().endsWith(".epub")
      ? "epub"
      : name.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : null;
    if (!format) throw new Error("Only EPUB and PDF files are supported.");
    const id = `book-${crypto.randomUUID()}`;
    const file = importFileName(name, format);
    const key = `${id}/${file}`;
    let published = false;
    try {
      let received = 0;
      const limited = body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            received += chunk.byteLength;
            if (received > size)
              throw new Error("The file exceeded its stated size.");
            controller.enqueue(chunk);
          },
        }),
      );
      await target.putStream(
        key,
        limited,
        size,
        format === "epub" ? "application/epub+zip" : "application/pdf",
      );
      const stored = await this.storage.head(key);
      if (!stored || stored.size !== size)
        throw new Error("The uploaded file was incomplete.");
      const source = rangedSource(stored.size, (offset, length) =>
        this.storage.readRange(key, offset, length),
      );
      const parsed =
        format === "epub"
          ? await readEpubSource(source)
          : await readPdfSource(source, name);
      const metadata = parsed.metadata;
      const publishedAt = new Date().toISOString();
      const book: Book = {
        id,
        addedAt: publishedAt,
        modifiedAt: publishedAt,
        title: metadata.title || name.replace(/\.(epub|pdf)$/i, ""),
        authors: metadata.authors ?? [],
        publisher: metadata.publisher,
        published: metadata.published,
        language: metadata.language,
        identifier: metadata.identifier,
        isbn: metadata.isbn,
        description: metadata.description,
        subjects: metadata.subjects,
        series: metadata.series,
        seriesIndex: metadata.seriesIndex,
        pages: metadata.pages,
        formats: [{ format, file, size }],
      };
      if (
        parsed.cover &&
        /^\.(jpg|jpeg|png|webp|gif|avif)$/.test(parsed.cover.extension)
      ) {
        book.cover = `cover${parsed.cover.extension}`;
        await target.write(
          `${id}/${book.cover}`,
          parsed.cover.body,
          `image/${parsed.cover.extension.slice(1).replace("jpg", "jpeg")}`,
        );
      }
      await target.write(
        `${id}/metadata.json`,
        encode(book),
        "application/json",
      );
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const storedCatalog = await this.catalogFile();
        const next: Catalog = {
          ...storedCatalog.value,
          generatedAt: new Date().toISOString(),
          books: [...storedCatalog.value.books, book],
        };
        if (
          await target.writeIf(
            CATALOG_FILE,
            encode(next),
            storedCatalog.etag,
            "application/json",
          )
        ) {
          published = true;
          await this.catalog.invalidate();
          return book;
        }
      }
      throw new Error("The catalog changed too many times while importing.");
    } finally {
      if (!published) {
        await Promise.all([
          target.remove(key),
          target.remove(`${id}/metadata.json`),
          ...["jpg", "jpeg", "png", "webp", "gif", "avif"].map((ext) =>
            target.remove(`${id}/cover.${ext}`),
          ),
        ]);
      }
    }
  }

  async pendingDeletions(): Promise<PendingBookDeletion[]> {
    return Object.values((await this.operations()).value.deletions).sort(
      (left, right) => left.requestedAt.localeCompare(right.requestedAt),
    );
  }

  /**
   * Removes a book from discovery, then cleans up every object and user-owned
   * reference. The private operation record makes every step retryable.
   */
  async removeBook(actor: User, id: string): Promise<Book> {
    const book = await this.beginBookDeletion(actor, id);
    await this.finishBookDeletion(actor, id);
    return book;
  }

  /** Makes a deletion durable and takes the book off the shelf. */
  async beginBookDeletion(actor: User, id: string): Promise<Book> {
    const target = writableStorage(this.storage);
    if (!target) throw new ReadOnlyLibraryError();
    await this.users.assertManager(actor);

    const deletion = await this.stageDeletion(id);
    await this.removeFromCatalog(id);
    await this.catalog.invalidate();
    return deletion.book;
  }

  /** Completes a staged deletion; safe to retry after an interrupted cleanup. */
  async finishBookDeletion(actor: User, id: string): Promise<void> {
    const target = writableStorage(this.storage);
    if (!target) throw new ReadOnlyLibraryError();
    await this.users.assertManager(actor);

    const deletion = (await this.operations()).value.deletions[id];
    if (!deletion) return;

    await writing("a deleted book's files", () =>
      Promise.all(
        bookObjectKeys(deletion.book).map((key) => target.remove(key)),
      ),
    );

    const users = await this.users.list();
    for (let offset = 0; offset < users.length; offset += 8) {
      await Promise.all(
        users
          .slice(offset, offset + 8)
          .map((user) =>
            Promise.all([
              this.progress.clear(user.id, id),
              this.readerMarks.clearBook(user.id, id),
            ]),
          ),
      );
    }

    await this.finishDeletion(id);
  }

  private async catalogFile(): Promise<Stored<Catalog>> {
    const object = await reading("the catalog", () =>
      this.storage.read(CATALOG_FILE),
    );
    if (!object) {
      return {
        value: { version: CATALOG_VERSION, books: [] },
        etag: null,
      };
    }
    if (!object.body)
      throw new Error("The catalog was returned without a body.");
    return {
      value: parseCatalog(await new Response(object.body).json()),
      etag: object.object.etag,
    };
  }

  private async operations(): Promise<Stored<LibraryOperations>> {
    const object = await reading("library operations", () =>
      this.storage.read(LIBRARY_OPERATIONS_FILE),
    );
    if (!object) {
      return {
        value: { version: OPERATIONS_VERSION, deletions: {} },
        etag: null,
      };
    }
    if (!object.body) {
      throw new Error("Library operations were returned without a body.");
    }
    return {
      value: parseOperations(await new Response(object.body).json()),
      etag: object.object.etag,
    };
  }

  private async stageDeletion(id: string): Promise<PendingBookDeletion> {
    const target = writableStorage(this.storage);
    if (!target) throw new ReadOnlyLibraryError();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const operations = await this.operations();
      const existing = operations.value.deletions[id];
      if (existing) return existing;

      const book = (await this.catalogFile()).value.books.find(
        (candidate) => candidate.id === id,
      );
      if (!book) throw new Error("That book no longer exists.");

      const deletion = { book, requestedAt: new Date().toISOString() };
      operations.value.deletions[id] = deletion;
      const written = await writing("a book deletion", () =>
        target.writeIf(
          LIBRARY_OPERATIONS_FILE,
          encode(operations.value),
          operations.etag,
          "application/json",
        ),
      );
      if (written) return deletion;
    }
    throw new Error("Library operations changed too many times while saving.");
  }

  private async removeFromCatalog(id: string): Promise<void> {
    const target = writableStorage(this.storage);
    if (!target) throw new ReadOnlyLibraryError();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const stored = await this.catalogFile();
      if (!stored.value.books.some((book) => book.id === id)) return;

      const next: Catalog = {
        ...stored.value,
        generatedAt: new Date().toISOString(),
        books: stored.value.books.filter((book) => book.id !== id),
      };
      const written = await writing("the catalog", () =>
        target.writeIf(
          CATALOG_FILE,
          encode(next),
          stored.etag,
          "application/json",
        ),
      );
      if (written) return;
    }
    throw new Error("The catalog changed too many times while saving.");
  }

  private async finishDeletion(id: string): Promise<void> {
    const target = writableStorage(this.storage);
    if (!target) throw new ReadOnlyLibraryError();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const operations = await this.operations();
      if (!operations.value.deletions[id]) return;
      delete operations.value.deletions[id];
      const written = await writing("library operations", () =>
        target.writeIf(
          LIBRARY_OPERATIONS_FILE,
          encode(operations.value),
          operations.etag,
          "application/json",
        ),
      );
      if (written) return;
    }
    throw new Error("Library operations changed too many times while saving.");
  }
}
