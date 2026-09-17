/**
 * The other half of a library.
 *
 * `catalog.ts` describes what the sync tool publishes — derived, regenerable,
 * the same for everyone. This describes what the app writes back: who is
 * reading, and how far they got. It is the only thing in the library the sync
 * tool did not put there, and so the only thing it must never take away.
 *
 * That is what {@link STATE_PREFIX} is for. Everything here lives under one
 * reserved folder, and providers exclude it from enumeration, so a `--force`
 * that empties the destination cannot also empty everyone's bookmarks.
 */

/** Bumped when either shape below changes incompatibly. */
export const STATE_VERSION = 1;

/**
 * Where app-written state lives, relative to the library root.
 *
 * Dot-prefixed because book folders are named after slugified titles and so
 * can never begin with one — the namespace is reserved by construction rather
 * than by hoping nobody publishes a book called "readlet".
 */
export const STATE_PREFIX = ".readlet/";

/** The authenticated users allowed to read this library. */
export const USERS_FILE = `${STATE_PREFIX}users.json`;

/** Interrupted manager operations that can be resumed without trusting input. */
export const LIBRARY_OPERATIONS_FILE = `${STATE_PREFIX}library-operations.json`;

/** One user's progress across every book they have opened. */
export function progressFile(userId: string): string {
  return `${STATE_PREFIX}progress/${userId}.json`;
}

/** Bookmarks and annotations owned by one user. */
export function readerMarksFile(userId: string): string {
  return `${STATE_PREFIX}reader-marks/${userId}.json`;
}

/** Whether a key belongs to the app rather than to the published library. */
export function isStateKey(key: string): boolean {
  return key.startsWith(STATE_PREFIX);
}

export type UserRole = "manager" | "member";
export type UserStatus = "pending" | "active" | "disabled" | "deleting";

/** A Cloudflare Access identity admitted to this library. */
export type User = {
  /** Stable Readlet identity, also used as the reading-state file name. */
  id: string;
  /** Bound on first login; never inferred again from an email address. */
  accessSubject?: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  createdBy: string;
};

export type UserDirectory = {
  version: number;
  users: User[];
};

/**
 * Where one reader got to in one book.
 *
 * Every field but the timestamp is optional because a position means different
 * things in different formats, and a book only ever has one of them: `cfi` and
 * `href` are EPUB-shaped, `page` is what a PDF has instead. They are kept flat
 * rather than as a discriminated union because every format writes to the
 * same per-user progress object.
 */
export type BookProgress = {
  /** An EPUB CFI: the position, precise to the character. */
  cfi?: string;
  /** The spine href it falls in, for showing where someone is without parsing. */
  href?: string;
  /** A PDF page, counting from one. */
  page?: number;
  /** ISO 8601. Decides which device wins when two have been reading. */
  updatedAt: string;
};

/** Everything one user has read, keyed by book id. */
export type Progress = {
  version: number;
  books: Record<string, BookProgress>;
};

/** User ids become file names, so they are constrained rather than trusted. */
export function isUserId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
}
