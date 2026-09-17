import assert from "node:assert/strict";
import { test } from "node:test";
import { acquirePdfViewerInputs } from "../src/app/read/[...key]/pdf-viewer-startup.ts";

test("viewer code and the ranged document open concurrently", async () => {
  let finishRuntime!: (runtime: string) => void;
  let finishDocument!: (opened: { close: () => void }) => void;
  const runtimeLoading = new Promise<string>((resolve) => {
    finishRuntime = resolve;
  });
  const documentOpening = new Promise<{ close: () => void }>((resolve) => {
    finishDocument = resolve;
  });
  const started: string[] = [];
  const inputs = acquirePdfViewerInputs(
    () => {
      started.push("viewer");
      return runtimeLoading;
    },
    () => {
      started.push("document");
      return documentOpening;
    },
  );

  assert.deepEqual(started, ["viewer", "document"]);
  const opened = { close: () => {} };
  finishDocument(opened);
  finishRuntime("ready");
  assert.deepEqual(await inputs, { runtime: "ready", opened });
});

test("a viewer load failure releases a document that already opened", async () => {
  let closed = false;
  await assert.rejects(
    acquirePdfViewerInputs(
      async () => {
        throw new Error("viewer chunk failed");
      },
      async () => ({
        close: () => {
          closed = true;
        },
      }),
    ),
    /viewer chunk failed/,
  );
  assert.equal(closed, true);
});
