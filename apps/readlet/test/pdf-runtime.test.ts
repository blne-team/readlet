import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initializePdfRuntime,
  loadPdfCore,
  PDFJS_ASSETS,
} from "../src/app/read/[...key]/pdf-runtime.ts";

test("the dependent viewer waits until the core finishes loading", async () => {
  let finishCore!: (core: { configured: boolean }) => void;
  const coreLoading = new Promise<{ configured: boolean }>((resolve) => {
    finishCore = resolve;
  });
  const loaded: string[] = [];

  const runtime = initializePdfRuntime(
    async () => {
      loaded.push("core requested");
      const core = await coreLoading;
      loaded.push("core ready");
      return core;
    },
    async () => {
      loaded.push("viewer requested");
      return { ready: true };
    },
  );

  assert.deepEqual(loaded, ["core requested"]);
  finishCore({ configured: true });
  assert.deepEqual(await runtime, {
    core: { configured: true },
    viewer: { ready: true },
  });
  assert.deepEqual(loaded, [
    "core requested",
    "core ready",
    "viewer requested",
  ]);
});

test("the real core provides the viewer global and a configured worker", async () => {
  const core = await loadPdfCore();
  const global = (
    globalThis as typeof globalThis & {
      pdfjsLib?: { getDocument?: unknown; version?: string };
    }
  ).pdfjsLib;
  assert.equal(global?.getDocument, core.getDocument);
  assert.equal(global?.version, core.version);
  assert.equal(
    core.GlobalWorkerOptions.workerSrc,
    `${PDFJS_ASSETS}pdf.worker.min.mjs`,
  );
});
