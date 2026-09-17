import {
  isUserId,
  progressFile,
  readerMarksFile,
  STATE_VERSION,
  type Storage,
  USERS_FILE,
  type User,
  type UserDirectory,
  type UserRole,
  writableStorage,
} from "@readlet/core";
import type { AccessIdentity } from "@/services/access-identity";
import { validatedEmail } from "@/services/access-identity";
import { reading, writing } from "@/services/errors";

export type { User, UserRole, UserStatus } from "@readlet/core";

const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_ATTEMPTS = 8;

export class UserAccessError extends Error {
  constructor(message = "This identity is not allowed to use this library.") {
    super(message);
    this.name = "UserAccessError";
  }
}

export class ReadOnlyUserDirectoryError extends Error {
  constructor() {
    super(
      "This library cannot change its users because its storage is read-only.",
    );
    this.name = "ReadOnlyUserDirectoryError";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function cleanDisplayName(value: unknown): string {
  const name =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return name.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function cleanEmail(value: unknown): string {
  return validatedEmail(value);
}

function newUserId(): string {
  return `u-${crypto.randomUUID()}`;
}

function encode(directory: UserDirectory): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(directory, null, 2));
}

function parseDirectory(value: unknown): UserDirectory {
  if (
    !record(value) ||
    value.version !== STATE_VERSION ||
    !Array.isArray(value.users)
  ) {
    throw new Error(
      "The user directory is malformed or uses an unsupported version.",
    );
  }

  const users: User[] = value.users.map((candidate) => {
    if (
      !record(candidate) ||
      typeof candidate.id !== "string" ||
      !isUserId(candidate.id) ||
      (candidate.accessSubject !== undefined &&
        (typeof candidate.accessSubject !== "string" ||
          !candidate.accessSubject.trim())) ||
      typeof candidate.email !== "string" ||
      cleanEmail(candidate.email) !== candidate.email ||
      typeof candidate.displayName !== "string" ||
      !cleanDisplayName(candidate.displayName) ||
      (candidate.role !== "manager" && candidate.role !== "member") ||
      (candidate.status !== "pending" &&
        candidate.status !== "active" &&
        candidate.status !== "disabled" &&
        candidate.status !== "deleting") ||
      typeof candidate.createdAt !== "string" ||
      typeof candidate.createdBy !== "string" ||
      !isUserId(candidate.createdBy) ||
      (candidate.status === "active" && !candidate.accessSubject) ||
      (candidate.status === "pending" && candidate.accessSubject !== undefined)
    ) {
      throw new Error("The user directory contains an invalid user.");
    }
    return candidate as User;
  });

  if (new Set(users.map((user) => user.id)).size !== users.length) {
    throw new Error("The user directory contains duplicate user ids.");
  }
  if (new Set(users.map((user) => user.email)).size !== users.length) {
    throw new Error("The user directory contains duplicate email addresses.");
  }
  const subjects = users.flatMap((user) =>
    user.accessSubject ? [user.accessSubject] : [],
  );
  if (new Set(subjects).size !== subjects.length) {
    throw new Error("The user directory contains duplicate Access identities.");
  }

  return { version: STATE_VERSION, users };
}

type StoredDirectory = { directory: UserDirectory; etag: string | null };

/** Membership, roles, and the binding from Cloudflare identities to readers. */
export class UserService {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  get writable(): boolean {
    return writableStorage(this.storage) !== null;
  }

  private async stored(): Promise<StoredDirectory> {
    const object = await reading("the user directory", () =>
      this.storage.read(USERS_FILE),
    );
    if (!object) {
      return {
        directory: { version: STATE_VERSION, users: [] },
        etag: null,
      };
    }
    if (!object.body) throw new Error("The user directory had no body.");
    const parsed = JSON.parse(await new Response(object.body).text());
    return { directory: parseDirectory(parsed), etag: object.object.etag };
  }

  private async write(
    directory: UserDirectory,
    etag: string | null,
  ): Promise<boolean> {
    const target = writableStorage(this.storage);
    if (!target) throw new ReadOnlyUserDirectoryError();
    return writing("the user directory", () =>
      target.writeIf(USERS_FILE, encode(directory), etag, "application/json"),
    );
  }

  async list(): Promise<User[]> {
    return (await this.stored()).directory.users.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }

  /** Revalidates that an authenticated actor still has manager access. */
  async assertManager(actor: User): Promise<void> {
    this.manager((await this.stored()).directory, actor);
  }

  /** Resolves, binds, or bootstraps one verified Cloudflare identity. */
  async resolve(
    identity: AccessIdentity,
    bootstrapManagerEmail: string,
  ): Promise<User> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { directory, etag } = await this.stored();
      const bound = directory.users.find(
        (user) => user.accessSubject === identity.subject,
      );
      if (bound) {
        if (bound.status !== "active") throw new UserAccessError();
        if (bound.email === identity.email) return bound;
        if (directory.users.some((user) => user.email === identity.email)) {
          throw new UserAccessError(
            "That verified email belongs to another user.",
          );
        }
        bound.email = identity.email;
        if (await this.write(directory, etag)) return bound;
        continue;
      }

      const matchingEmail = directory.users.find(
        (user) => user.email === identity.email,
      );
      if (matchingEmail) {
        if (matchingEmail.status !== "pending") throw new UserAccessError();
        matchingEmail.accessSubject = identity.subject;
        matchingEmail.status = "active";
        if (await this.write(directory, etag)) return matchingEmail;
        continue;
      }

      if (
        directory.users.length === 0 &&
        identity.email === bootstrapManagerEmail
      ) {
        const id = newUserId();
        const manager: User = {
          id,
          accessSubject: identity.subject,
          email: identity.email,
          displayName: identity.email,
          role: "manager",
          status: "active",
          createdAt: new Date().toISOString(),
          createdBy: id,
        };
        directory.users.push(manager);
        if (await this.write(directory, etag)) return manager;
        continue;
      }

      throw new UserAccessError();
    }
    throw new Error(
      "The user directory changed too many times while signing in.",
    );
  }

  private manager(directory: UserDirectory, actor: User): User {
    const current = directory.users.find(
      (user) =>
        user.id === actor.id &&
        user.accessSubject === actor.accessSubject &&
        user.status === "active",
    );
    if (current?.role !== "manager") {
      throw new UserAccessError("Manager access is required.");
    }
    return current;
  }

  private async change<T>(
    actor: User,
    mutate: (directory: UserDirectory, manager: User) => T,
  ): Promise<T> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { directory, etag } = await this.stored();
      const result = mutate(directory, this.manager(directory, actor));
      if (await this.write(directory, etag)) return result;
    }
    throw new Error("The user directory changed too many times while saving.");
  }

  async invite(
    actor: User,
    input: { email: unknown; displayName: unknown; role: UserRole },
  ): Promise<User> {
    const email = cleanEmail(input.email);
    if (!email) throw new Error("A valid email address is required.");
    const displayName = cleanDisplayName(input.displayName) || email;
    if (input.role !== "manager" && input.role !== "member") {
      throw new Error("Choose a valid role.");
    }

    return this.change(actor, (directory, manager) => {
      if (directory.users.some((user) => user.email === email)) {
        throw new Error("That email address is already in the user directory.");
      }
      const user: User = {
        id: newUserId(),
        email,
        displayName,
        role: input.role,
        status: "pending",
        createdAt: new Date().toISOString(),
        createdBy: manager.id,
      };
      directory.users.push(user);
      return user;
    });
  }

  async update(
    actor: User,
    id: string,
    input: { displayName: unknown; role: UserRole },
  ): Promise<void> {
    const displayName = cleanDisplayName(input.displayName);
    if (!displayName) throw new Error("A user needs a display name.");
    if (input.role !== "manager" && input.role !== "member") {
      throw new Error("Choose a valid role.");
    }

    await this.change(actor, (directory) => {
      const user = directory.users.find((candidate) => candidate.id === id);
      if (!user) throw new Error("That user no longer exists.");
      if (user.status === "deleting")
        throw new Error("That user is being deleted.");
      user.displayName = displayName;
      user.role = input.role;
      this.requireActiveManager(directory);
    });
  }

  async setEnabled(actor: User, id: string, enabled: boolean): Promise<void> {
    await this.change(actor, (directory) => {
      const user = directory.users.find((candidate) => candidate.id === id);
      if (!user) throw new Error("That user no longer exists.");
      if (user.status === "deleting")
        throw new Error("That user is being deleted.");
      user.status = enabled
        ? user.accessSubject
          ? "active"
          : "pending"
        : "disabled";
      this.requireActiveManager(directory);
    });
  }

  async rebind(actor: User, id: string): Promise<void> {
    await this.change(actor, (directory) => {
      const user = directory.users.find((candidate) => candidate.id === id);
      if (!user) throw new Error("That user no longer exists.");
      if (user.status === "deleting")
        throw new Error("That user is being deleted.");
      delete user.accessSubject;
      user.status = "pending";
      this.requireActiveManager(directory);
    });
  }

  async remove(actor: User, id: string): Promise<void> {
    await this.change(actor, (directory) => {
      const user = directory.users.find((candidate) => candidate.id === id);
      if (!user) throw new Error("That user no longer exists.");
      user.status = "deleting";
      this.requireActiveManager(directory);
    });

    const target = writableStorage(this.storage);
    if (!target) throw new ReadOnlyUserDirectoryError();
    await writing("the deleted user's reading state", async () => {
      await Promise.all([
        target.remove(progressFile(id)),
        target.remove(readerMarksFile(id)),
      ]);
    });

    await this.change(actor, (directory) => {
      directory.users = directory.users.filter((user) => user.id !== id);
      this.requireActiveManager(directory);
    });
  }

  private requireActiveManager(directory: UserDirectory): void {
    if (
      !directory.users.some(
        (user) => user.role === "manager" && user.status === "active",
      )
    ) {
      throw new Error("The library must keep at least one active manager.");
    }
  }
}
