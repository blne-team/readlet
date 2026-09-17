import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG_FILE, USERS_FILE, type UserDirectory } from "@readlet/core";
import { bookPdf } from "@readlet/fixtures";
import { POST as importUrl } from "../src/app/api/library/import-url/route.ts";
import { POST as upload } from "../src/app/api/library/upload/route.ts";
import { GET as download } from "../src/app/download/[...key]/route.ts";
import { createServices, setServices } from "../src/services/container.ts";
import { startAccessFixture } from "./lib/access.ts";
import { memoryStorage, nullCache } from "./lib/storage.ts";

test("file upload and HTTPS URL import publish PDFs", async () => {
  const access = await startAccessFixture();
  const manager = {
    id: "u-11111111-1111-4111-8111-111111111111",
    accessSubject: "cf-manager",
    email: "manager@example.com",
    displayName: "Manager",
    role: "manager" as const,
    status: "active" as const,
    createdAt: new Date(0).toISOString(),
    createdBy: "u-11111111-1111-4111-8111-111111111111",
  };
  const memory = memoryStorage({
    [USERS_FILE]: JSON.stringify({
      version: 1,
      users: [manager],
    } satisfies UserDirectory),
  });
  setServices(createServices(memory.storage, nullCache()));
  const bytes = bookPdf({ title: "Imported PDF" });
  const token = await access.tokenFor(manager.accessSubject, manager.email);
  const headers = { "cf-access-jwt-assertion": token };
  const fetchBeforeDownload = globalThis.fetch;

  try {
    const uploaded = await upload(
      new Request("https://shelf.test/api/library/upload", {
        method: "POST",
        headers: {
          ...headers,
          "x-file-name": encodeURIComponent("Résumé (final).pdf"),
          "x-file-size": String(bytes.byteLength),
        },
        body: bytes as Uint8Array<ArrayBuffer>,
      }),
    );
    assert.equal(uploaded.status, 201);
    const uploadedBook = (await uploaded.json()) as {
      book: { id: string; title: string; formats: { file: string }[] };
    };
    assert.equal(uploadedBook.book.title, "Imported PDF");
    assert.equal(uploadedBook.book.formats[0]?.file, "Resume-final.pdf");
    assert.equal(memory.has(`${uploadedBook.book.id}/Resume-final.pdf`), true);
    const downloaded = await download(
      new Request(
        `https://shelf.test/download/${uploadedBook.book.id}/Resume-final.pdf`,
        { headers },
      ),
      {
        params: Promise.resolve({
          key: [uploadedBook.book.id, "Resume-final.pdf"],
        }),
      } as Parameters<typeof download>[1],
    );
    assert.equal(downloaded.status, 200);
    assert.match(
      downloaded.headers.get("content-disposition") ?? "",
      /^attachment; filename="Resume-final\.pdf"/,
    );

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      if (String(input) === "https://files.example.com/My%20Book.pdf") {
        return new Response(bytes as Uint8Array<ArrayBuffer>, {
          headers: {
            "content-length": String(bytes.byteLength),
            "content-type": "application/pdf",
          },
        });
      }
      return fetchBeforeDownload(input, init);
    }) as typeof fetch;
    const imported = await importUrl(
      new Request("https://shelf.test/api/library/import-url", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://files.example.com/My%20Book.pdf",
        }),
      }),
    );
    assert.equal(imported.status, 201);
    const importedBook = (await imported.json()) as {
      book: { id: string; title: string; formats: { file: string }[] };
    };
    assert.equal(importedBook.book.title, "Imported PDF");
    assert.equal(importedBook.book.formats[0]?.file, "My-Book.pdf");
    assert.equal(memory.has(`${importedBook.book.id}/My-Book.pdf`), true);
    assert.equal(
      memory.json<{ books: unknown[] }>(CATALOG_FILE).books.length,
      2,
    );
  } finally {
    globalThis.fetch = fetchBeforeDownload;
    setServices(null);
    access.stop();
  }
});
