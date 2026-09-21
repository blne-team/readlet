import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CATALOG_VERSION, type Catalog } from "@readlet/core";
import { createAdmin } from "@readlet/provider-r2/node";

test("publishes R2 contributions through the protected Worker endpoint", async () => {
  const previousFetch = globalThis.fetch;
  const previousId = process.env.READLET_SYNC_ACCESS_CLIENT_ID;
  const previousSecret = process.env.READLET_SYNC_ACCESS_CLIENT_SECRET;
  process.env.READLET_SYNC_ACCESS_CLIENT_ID = "client.access";
  process.env.READLET_SYNC_ACCESS_CLIENT_SECRET = "secret";
  const calls: { method: string; headers: Headers }[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
    });
    if (init?.method === "POST") return Response.json({ removed: 2 });
    if (init?.method === "PUT") return new Response(null, { status: 204 });
    return Response.json({ version: CATALOG_VERSION, books: [] });
  }) as typeof fetch;

  try {
    const directory = await mkdtemp(path.join(tmpdir(), "readlet-r2-"));
    const file = path.join(directory, "book.epub");
    await writeFile(file, "book");
    const admin = await createAdmin({
      endpoint: "https://readlet.example.com/api/library/sync",
    });
    const catalog: Catalog = { version: CATALOG_VERSION, books: [] };

    assert.ok(await admin.read("catalog.json"));
    await admin.put("sync-book/book.epub", file, "application/epub+zip");
    assert.equal(await admin.publish(catalog), 2);

    assert.deepEqual(
      calls.map((call) => call.method),
      ["GET", "PUT", "POST"],
    );
    assert.equal(calls[1].headers.get("cf-access-client-id"), "client.access");
    assert.equal(calls[1].headers.get("cf-access-client-secret"), "secret");
    assert.equal(calls[1].headers.get("x-readlet-key"), "sync-book/book.epub");
    assert.equal(calls[1].headers.get("content-length"), "4");
  } finally {
    globalThis.fetch = previousFetch;
    restore("READLET_SYNC_ACCESS_CLIENT_ID", previousId);
    restore("READLET_SYNC_ACCESS_CLIENT_SECRET", previousSecret);
  }
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
