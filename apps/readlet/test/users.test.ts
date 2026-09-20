import assert from "node:assert/strict";
import { test } from "node:test";
import {
  progressFile,
  readerMarksFile,
  USERS_FILE,
  type User,
  type UserDirectory,
} from "@readlet/core";
import { LibraryUnavailableError } from "../src/services/errors.ts";
import {
  ReadOnlyUserDirectoryError,
  UserAccessError,
  UserService,
} from "../src/services/users.ts";
import { memoryStorage } from "./lib/storage.ts";

const aliceIdentity = { subject: "cf-alice", email: "alice@example.com" };

function user(overrides: Partial<User> = {}): User {
  return {
    id: "u-11111111-1111-4111-8111-111111111111",
    accessSubject: "cf-alice",
    email: "alice@example.com",
    displayName: "Alice",
    role: "manager",
    status: "active",
    createdAt: new Date(0).toISOString(),
    createdBy: "u-11111111-1111-4111-8111-111111111111",
    ...overrides,
  };
}

function directory(users: User[]): Record<string, string> {
  return {
    [USERS_FILE]: JSON.stringify({ version: 1, users } satisfies UserDirectory),
  };
}

test("only the configured verified email can bootstrap the first manager", async () => {
  const library = memoryStorage({});
  const users = new UserService(library.storage);

  await assert.rejects(
    users.resolve(aliceIdentity, "owner@example.com"),
    UserAccessError,
  );
  const manager = await users.resolve(aliceIdentity, aliceIdentity.email);

  assert.equal(manager.role, "manager");
  assert.equal(manager.status, "active");
  assert.equal(manager.accessSubject, aliceIdentity.subject);
  assert.equal(library.json<UserDirectory>(USERS_FILE).users.length, 1);
});

test("an invited email binds once to its verified Access subject", async () => {
  const manager = user();
  const library = memoryStorage(directory([manager]));
  const users = new UserService(library.storage);
  const invited = await users.invite(manager, {
    email: "Bob@Example.com",
    displayName: "Bob",
    role: "member",
  });

  assert.equal(invited.status, "pending");
  const bob = await users.resolve(
    { subject: "cf-bob", email: "bob@example.com" },
    manager.email,
  );
  assert.equal(bob.id, invited.id);
  assert.equal(bob.status, "active");
  assert.equal(bob.accessSubject, "cf-bob");

  await assert.rejects(
    users.resolve(
      { subject: "different-subject", email: "bob@example.com" },
      manager.email,
    ),
    UserAccessError,
  );
});

test("the bound subject survives a verified email change", async () => {
  const manager = user();
  const library = memoryStorage(directory([manager]));
  const users = new UserService(library.storage);

  const resolved = await users.resolve(
    { subject: "cf-alice", email: "new@example.com" },
    manager.email,
  );
  assert.equal(resolved.id, manager.id);
  assert.equal(resolved.email, "new@example.com");
});

test("members cannot mutate the directory even with a service reference", async () => {
  const manager = user();
  const member = user({
    id: "u-22222222-2222-4222-8222-222222222222",
    accessSubject: "cf-bob",
    email: "bob@example.com",
    displayName: "Bob",
    role: "member",
    createdBy: manager.id,
  });
  const users = new UserService(
    memoryStorage(directory([manager, member])).storage,
  );

  await assert.rejects(
    users.invite(member, {
      email: "eve@example.com",
      displayName: "Eve",
      role: "member",
    }),
    UserAccessError,
  );
});

test("an OPDS app password authenticates until it is replaced or revoked", async () => {
  const manager = user();
  const library = memoryStorage(directory([manager]));
  const users = new UserService(library.storage);

  const first = await users.createOpdsCredential(manager, manager.id);
  assert.equal(
    (await users.authenticateOpds(first.username, first.password)).id,
    manager.id,
  );
  await assert.rejects(
    users.authenticateOpds(first.username, "wrong"),
    UserAccessError,
  );

  const second = await users.createOpdsCredential(manager, manager.id);
  await assert.rejects(
    users.authenticateOpds(first.username, first.password),
    UserAccessError,
  );
  assert.equal(
    (await users.authenticateOpds(second.username, second.password)).id,
    manager.id,
  );

  await users.revokeOpdsCredential(manager, manager.id);
  await assert.rejects(
    users.authenticateOpds(second.username, second.password),
    UserAccessError,
  );
});

test("the final active manager cannot be disabled, demoted, rebound, or removed", async () => {
  const manager = user();
  const users = new UserService(memoryStorage(directory([manager])).storage);

  await assert.rejects(
    users.setEnabled(manager, manager.id, false),
    /at least one active manager/,
  );
  await assert.rejects(
    users.update(manager, manager.id, {
      displayName: manager.displayName,
      role: "member",
    }),
    /at least one active manager/,
  );
  await assert.rejects(
    users.rebind(manager, manager.id),
    /at least one active manager/,
  );
  await assert.rejects(
    users.remove(manager, manager.id),
    /at least one active manager/,
  );
});

test("removing a user removes their reading state after directory access", async () => {
  const manager = user();
  const member = user({
    id: "u-22222222-2222-4222-8222-222222222222",
    accessSubject: "cf-bob",
    email: "bob@example.com",
    displayName: "Bob",
    role: "member",
    createdBy: manager.id,
  });
  const library = memoryStorage({
    ...directory([manager, member]),
    [progressFile(member.id)]: '{"version":1,"books":{}}',
    [readerMarksFile(member.id)]: '{"version":1,"books":{}}',
  });
  const users = new UserService(library.storage);

  await users.remove(manager, member.id);

  assert.equal(library.has(progressFile(member.id)), false);
  assert.equal(library.has(readerMarksFile(member.id)), false);
  assert.deepEqual(
    (await users.list()).map((entry) => entry.id),
    [manager.id],
  );
});

test("failed deletion is denied and can be finished after storage recovers", async () => {
  const manager = user();
  const member = user({
    id: "u-22222222-2222-4222-8222-222222222222",
    accessSubject: "cf-bob",
    email: "bob@example.com",
    displayName: "Bob",
    role: "member",
    createdBy: manager.id,
  });
  const library = memoryStorage({
    ...directory([manager, member]),
    [progressFile(member.id)]: '{"version":1,"books":{}}',
    [readerMarksFile(member.id)]: '{"version":1,"books":{}}',
  });
  const users = new UserService(library.storage);

  library.fail("remove");
  await assert.rejects(
    users.remove(manager, member.id),
    LibraryUnavailableError,
  );
  library.heal();
  assert.equal(
    (await users.list()).find((entry) => entry.id === member.id)?.status,
    "deleting",
  );
  await assert.rejects(
    users.resolve({ subject: "cf-bob", email: member.email }, manager.email),
    UserAccessError,
  );
  await assert.rejects(
    users.setEnabled(manager, member.id, true),
    /being deleted/,
  );

  await users.remove(manager, member.id);
  assert.equal(library.has(progressFile(member.id)), false);
  assert.equal(library.has(readerMarksFile(member.id)), false);
  assert.deepEqual(
    (await users.list()).map((entry) => entry.id),
    [manager.id],
  );
});

test("read-only and unreachable directories fail explicitly", async () => {
  const manager = user();
  const readOnly = new UserService(
    memoryStorage(directory([manager]), { writable: false }).storage,
  );
  await assert.rejects(
    readOnly.invite(manager, {
      email: "bob@example.com",
      displayName: "Bob",
      role: "member",
    }),
    ReadOnlyUserDirectoryError,
  );

  const unavailableLibrary = memoryStorage(directory([manager]), {
    failing: true,
  });
  const unavailable = new UserService(unavailableLibrary.storage);
  await assert.rejects(unavailable.list(), LibraryUnavailableError);
  await assert.rejects(
    unavailable.resolve(aliceIdentity, manager.email),
    LibraryUnavailableError,
  );
});

test("malformed directories are never treated as an empty bootstrap state", async () => {
  const users = new UserService(
    memoryStorage({ [USERS_FILE]: '{"version":1,"users":[{}]}' }).storage,
  );
  await assert.rejects(
    users.resolve(aliceIdentity, aliceIdentity.email),
    /invalid user/,
  );
});
