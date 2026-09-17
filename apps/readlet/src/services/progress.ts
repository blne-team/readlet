import {
  type BookProgress,
  type Progress,
  progressFile,
  STATE_VERSION,
  type Storage,
  writableStorage,
} from "@readlet/core";
import { reading, writing } from "@/services/errors";

export type { BookProgress } from "@readlet/core";

/**
 * A position as a reader reports it: everything {@link BookProgress} holds
 * except the timestamp, which is the library's to set. Derived rather than
 * restated so that a new kind of position reaches this service by adding one
 * field to one type.
 */
export type ReadingPosition = Omit<BookProgress, "updatedAt">;

/**
 * How far each user got in each book.
 *
 * One object per user rather than one per book: a page turn costs a read
 * and a write either way, and this way the shelf can show every position it
 * knows about in a single request.
 *
 * Two devices reading the same book as the same user are last-write-wins.
 * Writes to different books preserve both entries.
 */
export class ProgressService {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  get writable(): boolean {
    return writableStorage(this.storage) !== null;
  }

  /** The file as it stands, which a caller about to rewrite it must have. */
  private async stored(userId: string): Promise<{
    books: Record<string, BookProgress>;
    etag: string | null;
  }> {
    const object = await reading("a reading position", () =>
      this.storage.read(progressFile(userId)),
    );
    if (!object) return { books: {}, etag: null };
    if (!object.body)
      throw new Error("Reading positions were returned without a body.");
    const parsed: unknown = JSON.parse(await new Response(object.body).text());
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      !("version" in parsed) ||
      parsed.version !== STATE_VERSION ||
      !("books" in parsed) ||
      !parsed.books ||
      typeof parsed.books !== "object" ||
      Array.isArray(parsed.books)
    ) {
      throw new Error(
        "Reading positions are malformed or use an unsupported version.",
      );
    }
    return {
      books: parsed.books as Record<string, BookProgress>,
      etag: object.object.etag,
    };
  }

  /**
   * Every position this user has, keyed by book id.
   *
   * A missing position file is empty; corrupt files and storage failures are errors.
   */
  async all(userId: string): Promise<Record<string, BookProgress>> {
    return (await this.stored(userId)).books;
  }

  async get(userId: string, bookId: string): Promise<BookProgress | null> {
    return (await this.all(userId))[bookId] ?? null;
  }

  /**
   * Records a position. False only where the library is read-only.
   *
   * The file holds every book this user has open and is rewritten whole, so
   * writing it after a failed read would replace all of those positions with
   * this one. Failed reads and writes therefore surface as errors.
   */
  async save(
    userId: string,
    bookId: string,
    position: ReadingPosition,
  ): Promise<boolean> {
    const target = writableStorage(this.storage);
    if (!target) return false;

    return this.change(target, userId, (books) => {
      // Only the fields that were given, so a format's position is stored in
      // the shape that format has rather than padded out with empty ones.
      books[bookId] = {
        ...(position.cfi ? { cfi: position.cfi } : {}),
        ...(position.href ? { href: position.href } : {}),
        ...(position.page ? { page: position.page } : {}),
        updatedAt: new Date().toISOString(),
      };
      return true;
    });
  }

  /** Forgets one book, or every book when no id is given. */
  async clear(userId: string, bookId?: string): Promise<boolean> {
    const target = writableStorage(this.storage);
    if (!target) return false;

    if (!bookId) {
      await writing("reading positions", () =>
        target.remove(progressFile(userId)),
      );
      return true;
    }

    return this.change(target, userId, (books) => {
      if (!(bookId in books)) return false;
      delete books[bookId];
      return true;
    });
  }

  /** Applies one edit without replacing a concurrent edit from another device. */
  private async change(
    target: NonNullable<ReturnType<typeof writableStorage>>,
    userId: string,
    mutate: (books: Record<string, BookProgress>) => boolean,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { books, etag } = await this.stored(userId);
      if (!mutate(books)) return true;
      const bytes = new TextEncoder().encode(
        JSON.stringify({ version: STATE_VERSION, books } satisfies Progress),
      );
      if (
        await writing("reading positions", () =>
          target.writeIf(progressFile(userId), bytes, etag, "application/json"),
        )
      )
        return true;
    }
    throw new Error("Reading positions changed too many times while saving.");
  }
}
