"use client";

import {
  Check,
  CheckCircle2,
  FileText,
  Link2,
  LoaderCircle,
  TriangleAlert,
  UploadCloud,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BUTTON, BUTTON_PRIMARY, INPUT } from "@/app/ui";

const MAX_BOOK_BYTES = 100_000_000;

type ImportMode = "file" | "url";
type ImportPhase = "idle" | "uploading" | "processing" | "success" | "error";
type ImportResult = {
  error?: string;
  book?: { title: string };
};

function fileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function responseError(status: number, result: ImportResult | null): string {
  return (
    result?.error ||
    (status === 413
      ? "The server rejected the file size. Try a file under 100 MB."
      : status === 429
        ? "Too many requests. Wait a minute and try again."
        : `Import failed (HTTP ${status}).`)
  );
}

function uploadFile(
  file: File,
  onProgress: (percent: number) => void,
  onProcessing: () => void,
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/library/upload");
    request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    request.setRequestHeader("x-file-size", String(file.size));
    request.responseType = "json";

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
      }
    });
    request.upload.addEventListener("load", onProcessing);
    request.addEventListener("load", () => {
      const result = request.response as ImportResult | null;
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(responseError(request.status, result)));
        return;
      }
      resolve(result ?? {});
    });
    request.addEventListener("error", () => {
      reject(
        new Error(
          "The upload was interrupted. Check your connection and try again.",
        ),
      );
    });
    request.addEventListener("abort", () => {
      reject(new Error("The upload was cancelled."));
    });
    request.send(file);
  });
}

export function ImportBook() {
  const router = useRouter();
  const fileInputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const busy = phase === "uploading" || phase === "processing";

  useEffect(() => {
    if (!busy) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [busy]);

  function resetFeedback() {
    setPhase("idle");
    setMessage("");
    setProgress(0);
  }

  function chooseMode(nextMode: ImportMode) {
    if (busy || nextMode === mode) return;
    setMode(nextMode);
    resetFeedback();
  }

  function chooseFile(nextFile: File | null) {
    setDragging(false);
    if (!nextFile) {
      setFile(null);
      resetFeedback();
      return;
    }
    if (nextFile.size > MAX_BOOK_BYTES) {
      setFile(null);
      setPhase("error");
      setMessage("This file is larger than the 100 MB limit.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (
      !/\.(epub|pdf)$/i.test(nextFile.name) &&
      !["application/epub+zip", "application/pdf"].includes(nextFile.type)
    ) {
      setFile(null);
      setPhase("error");
      setMessage("Choose an EPUB or PDF file.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFile(nextFile);
    resetFeedback();
  }

  async function finish(result: ImportResult) {
    if (!result.book) throw new Error("The server did not confirm the import.");
    setMessage(result.book.title);
    setPhase("success");
    setFile(null);
    setUrl("");
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  async function submitFile() {
    if (!file || busy) return;
    setMessage("");
    setProgress(0);
    setPhase("uploading");
    try {
      const result = await uploadFile(
        file,
        (percent) => {
          setProgress(percent);
          setPhase("uploading");
        },
        () => {
          setProgress(100);
          setPhase("processing");
        },
      );
      await finish(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
      setPhase("error");
    }
  }

  async function submitUrl() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || busy) return;
    setMessage("");
    setPhase("processing");
    try {
      if (/^blob:/i.test(trimmedUrl)) {
        throw new Error(
          "A blob: link only works in the browser that created it. Download the file and upload it instead.",
        );
      }
      const response = await fetch("/api/library/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const result = (await response
        .json()
        .catch(() => null)) as ImportResult | null;
      if (!response.ok) throw new Error(responseError(response.status, result));
      await finish(result ?? {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
      setPhase("error");
    }
  }

  return (
    <section
      aria-labelledby="import-book-heading"
      aria-busy={busy}
      className="mt-10 overflow-hidden rounded-3xl border border-separator bg-surface"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"
          >
            <UploadCloud className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 id="import-book-heading" className="text-xl font-semibold">
              Add a book
            </h2>
            <p className="mt-1 text-sm leading-6 text-secondary">
              Add an EPUB or PDF from your device or a public link. Maximum file
              size is 100 MB.
            </p>
          </div>
        </div>

        <fieldset className="mt-6 grid min-w-0 grid-cols-2 rounded-xl bg-fill p-1">
          <legend className="sr-only">Import source</legend>
          <button
            type="button"
            aria-pressed={mode === "file"}
            disabled={busy}
            onClick={() => chooseMode("file")}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              mode === "file"
                ? "bg-surface text-foreground shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            <UploadCloud aria-hidden="true" className="size-4" />
            Upload file
          </button>
          <button
            type="button"
            aria-pressed={mode === "url"}
            disabled={busy}
            onClick={() => chooseMode("url")}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              mode === "url"
                ? "bg-surface text-foreground shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            <Link2 aria-hidden="true" className="size-4" />
            Import link
          </button>
        </fieldset>

        {mode === "file" ? (
          <div className="mt-5">
            <label
              htmlFor={fileInputId}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  setDragging(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!busy) chooseFile(event.dataTransfer.files[0] ?? null);
              }}
              className={`flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-7 text-center transition-colors ${
                busy
                  ? "cursor-not-allowed border-separator bg-fill/50 opacity-60"
                  : dragging
                    ? "cursor-pointer border-accent bg-accent/10"
                    : "cursor-pointer border-separator bg-fill/40 hover:border-accent/50 hover:bg-fill"
              }`}
            >
              <input
                ref={fileInput}
                id={fileInputId}
                type="file"
                accept=".epub,.pdf,application/epub+zip,application/pdf"
                disabled={busy}
                onChange={(event) =>
                  chooseFile(event.target.files?.[0] ?? null)
                }
                className="sr-only"
              />
              {file ? (
                <>
                  <span className="flex size-11 items-center justify-center rounded-xl bg-surface text-accent shadow-sm">
                    <FileText aria-hidden="true" className="size-5" />
                  </span>
                  <span className="mt-3 max-w-full truncate text-sm font-medium">
                    {file.name}
                  </span>
                  <span className="mt-1 text-xs text-secondary">
                    {fileSize(file.size)} · Ready to upload
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud
                    aria-hidden="true"
                    className="size-7 text-secondary"
                    strokeWidth={1.5}
                  />
                  <span className="mt-3 text-sm font-medium">
                    Drop an EPUB or PDF here
                  </span>
                  <span className="mt-1 text-xs text-secondary">
                    or click to choose a file
                  </span>
                </>
              )}
            </label>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-secondary">
                EPUB or PDF · Up to 100 MB
              </span>
              <div className="flex items-center gap-2">
                {file && !busy && (
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => chooseFile(null)}
                    className="inline-flex size-11 items-center justify-center rounded-full text-secondary transition-colors hover:bg-fill hover:text-foreground"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy || !file}
                  onClick={() => void submitFile()}
                  className={`${BUTTON_PRIMARY} gap-2 disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {busy && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  )}
                  {busy ? "Importing…" : "Upload book"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitUrl();
            }}
            className="mt-5"
          >
            <label htmlFor="book-file-url" className="text-sm font-medium">
              Public file URL
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Link2
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-tertiary"
                />
                <input
                  id="book-file-url"
                  type="url"
                  required
                  disabled={busy}
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    if (phase === "error" || phase === "success")
                      resetFeedback();
                  }}
                  placeholder="https://example.com/book.epub"
                  className={`${INPUT} w-full pl-10 disabled:cursor-not-allowed disabled:opacity-60`}
                />
              </div>
              <button
                type="submit"
                disabled={busy || !url.trim()}
                className={`${BUTTON_PRIMARY} shrink-0 gap-2 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {busy && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                )}
                {busy ? "Importing…" : "Import book"}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-secondary">
              GitHub file pages and Raw links are supported. The URL must point
              directly to a public EPUB or PDF.
            </p>
          </form>
        )}
      </div>

      {phase !== "idle" && (
        <div
          role={phase === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`border-t px-5 py-5 sm:px-6 ${
            phase === "success"
              ? "border-emerald-500/20 bg-emerald-500/8"
              : phase === "error"
                ? "border-red-500/20 bg-red-500/8"
                : "border-separator bg-fill/40"
          }`}
        >
          {busy && (
            <div>
              <div className="flex items-start gap-3">
                <LoaderCircle
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 animate-spin text-accent"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">
                      {phase === "uploading"
                        ? "Uploading file"
                        : "Preparing your book"}
                    </p>
                    <span className="shrink-0 text-sm tabular-nums text-secondary">
                      {phase === "uploading" ? `${progress}%` : "Working…"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-secondary">
                    {phase === "uploading"
                      ? "Sending the file to your library."
                      : mode === "url"
                        ? "Downloading the file and adding it to your shelf."
                        : "Upload complete. Reading metadata and adding it to your shelf."}
                  </p>
                </div>
              </div>
              <div
                role="progressbar"
                aria-label={
                  phase === "uploading"
                    ? "File upload progress"
                    : "Processing book"
                }
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={phase === "uploading" ? progress : undefined}
                className="mt-4 h-2 overflow-hidden rounded-full bg-fill-hover"
              >
                <div
                  className={
                    phase === "uploading"
                      ? "h-full rounded-full bg-accent transition-[width] duration-200"
                      : "import-progress-bar h-full w-1/3 rounded-full bg-accent"
                  }
                  style={
                    phase === "uploading"
                      ? { width: `${progress}%` }
                      : undefined
                  }
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs font-medium text-secondary">
                <span className="size-2 rounded-full bg-amber-500" />
                Keep this page open. We’ll tell you when the import is finished.
              </p>
            </div>
          )}

          {phase === "success" && (
            <div className="flex items-start gap-3">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-emerald-800 dark:text-emerald-300">
                  Book added successfully
                </p>
                <p className="mt-1 break-words text-sm text-secondary">
                  “{message}” is now on your shelf. You can safely leave this
                  page.
                </p>
              </div>
              <button
                type="button"
                onClick={resetFeedback}
                className={`${BUTTON} shrink-0 gap-1.5`}
              >
                <Check aria-hidden="true" className="size-4" />
                Done
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="flex items-start gap-3">
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-red-700 dark:text-red-300">
                  Import didn’t finish
                </p>
                <p className="mt-1 text-sm text-secondary">{message}</p>
                <p className="mt-2 text-xs text-secondary">
                  Your library was not changed. You can adjust the source and
                  try again.
                </p>
              </div>
              <button
                type="button"
                onClick={resetFeedback}
                className={`${BUTTON} shrink-0`}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
