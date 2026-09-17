import {
  readerMarksFile,
  STATE_VERSION,
  type Storage,
  writableStorage,
} from "@readlet/core";
import { parseReaderMark, type ReaderMark } from "@/domain/reader-marks";

type MarksFile = {
  version: number;
  books: Record<string, Record<string, ReaderMark>>;
};

const empty = (): MarksFile => ({ version: STATE_VERSION, books: {} });
/** User-owned marks; mutations address one item rather than replacing a list. */
export class ReaderMarksService {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  get writable(): boolean {
    return writableStorage(this.storage) !== null;
  }

  private async read(
    userId: string,
  ): Promise<{ file: MarksFile; etag: string | null }> {
    const object = await this.storage.read(readerMarksFile(userId));
    if (!object) return { file: empty(), etag: null };
    if (!object.body)
      throw new Error("Reader marks were returned without a body.");
    const bytes = await new Response(object.body).arrayBuffer();
    return {
      file: parseMarksFile(JSON.parse(new TextDecoder().decode(bytes))),
      etag: object.object.etag,
    };
  }

  private async change(
    userId: string,
    mutate: (file: MarksFile) => boolean,
  ): Promise<void> {
    const target = writableStorage(this.storage);
    if (!target) throw new Error("This library cannot change reader marks.");
    for (let attempt = 0; attempt < 8; attempt++) {
      const { file, etag } = await this.read(userId);
      if (!mutate(file)) return;
      const bytes = new TextEncoder().encode(JSON.stringify(file));
      if (
        await target.writeIf(
          readerMarksFile(userId),
          bytes,
          etag,
          "application/json",
        )
      )
        return;
    }
    throw new Error("Reader marks changed too many times while saving.");
  }

  async list(userId: string, bookId: string): Promise<ReaderMark[]> {
    const { file } = await this.read(userId);
    return Object.values(file.books[bookId] ?? {}).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async upsert(
    userId: string,
    bookId: string,
    mark: ReaderMark,
  ): Promise<void> {
    await this.change(userId, (file) => {
      if (!file.books[bookId]) file.books[bookId] = {};
      const book = file.books[bookId];
      const previous = book[mark.id];
      book[mark.id] = {
        ...mark,
        createdAt: previous?.createdAt ?? mark.createdAt,
        updatedAt: new Date().toISOString(),
      };
      return true;
    });
  }

  async remove(userId: string, bookId: string, id: string): Promise<void> {
    await this.change(userId, (file) => {
      if (!file.books[bookId]?.[id]) return false;
      delete file.books[bookId]?.[id];
      if (file.books[bookId] && Object.keys(file.books[bookId]).length === 0)
        delete file.books[bookId];
      return true;
    });
  }

  /** Removes every bookmark and annotation this user has for one book. */
  async clearBook(userId: string, bookId: string): Promise<void> {
    await this.change(userId, (file) => {
      if (!file.books[bookId]) return false;
      delete file.books[bookId];
      return true;
    });
  }
}

function parseMarksFile(value: unknown): MarksFile {
  if (!record(value) || value.version !== STATE_VERSION)
    throw new Error("Reader marks use an unsupported file version.");
  if (!record(value.books)) throw new Error("Reader marks are malformed.");

  const books: MarksFile["books"] = {};
  for (const [bookId, storedMarks] of Object.entries(value.books)) {
    if (!record(storedMarks)) throw new Error("Reader marks are malformed.");
    const marks: Record<string, ReaderMark> = {};
    for (const [id, storedMark] of Object.entries(storedMarks)) {
      const mark = parseReaderMark(storedMark);
      if (!mark || mark.id !== id)
        throw new Error("Reader marks contain an invalid mark.");
      marks[id] = mark;
    }
    books[bookId] = marks;
  }
  return { version: STATE_VERSION, books };
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
