"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BUTTON } from "@/app/ui";

export function ImportBook() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  async function submit(kind: "file" | "url") {
    if (kind === "file" && !file) return;
    if (kind === "file" && file && file.size > 100_000_000) {
      setMessage({
        text: "The file must be no larger than 100 MB.",
        error: true,
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (kind === "url" && /^blob:/i.test(url.trim())) {
        throw new Error(
          "A blob: link only works in the browser that created it. Download the PDF and upload it here, or paste a public HTTPS link to the file.",
        );
      }
      const response =
        kind === "file" && file
          ? await fetch("/api/library/upload", {
              method: "POST",
              headers: {
                "x-file-name": encodeURIComponent(file.name),
                "x-file-size": String(file.size),
              },
              body: file,
            })
          : await fetch("/api/library/import-url", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ url }),
            });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        book?: { title: string };
      } | null;
      if (!response.ok) {
        throw new Error(
          result?.error ||
            (response.status === 413
              ? "The server rejected the file size. Try a file under 100 MB."
              : response.status === 429
                ? "Too many requests. Wait a minute and try again."
                : `Import failed (HTTP ${response.status}).`),
        );
      }
      if (!result?.book)
        throw new Error("The server did not confirm the import.");
      setMessage({ text: `Added ${result.book.title}.`, error: false });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setUrl("");
      router.refresh();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Import failed.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-separator p-4 sm:p-5">
      <h2 className="text-xl font-semibold">Add a book</h2>
      <p className="mt-1 text-sm text-secondary">
        Import an EPUB or PDF from your device or a public HTTPS link (up to 100
        MB).
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          aria-label="Choose an EPUB or PDF"
          type="file"
          accept=".epub,.pdf,application/epub+zip,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="min-w-0 text-sm"
        />
        <button
          type="button"
          disabled={busy || !file}
          onClick={() => void submit("file")}
          className={BUTTON}
        >
          {busy ? "Importing…" : "Upload"}
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit("url");
        }}
        className="mt-4 flex flex-wrap gap-3"
      >
        <input
          aria-label="Book file URL"
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/book.epub"
          className="min-w-0 flex-1 rounded-xl border border-separator bg-transparent px-3 py-2"
        />
        <button type="submit" disabled={busy || !url} className={BUTTON}>
          {busy ? "Importing…" : "Import URL"}
        </button>
      </form>
      <p className="mt-2 text-sm text-secondary">
        GitHub file pages and Raw links are supported. A browser blob: link
        cannot be imported; download the file and upload it instead.
      </p>
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={`mt-3 text-sm ${message.error ? "text-red-600 dark:text-red-400" : "text-secondary"}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
