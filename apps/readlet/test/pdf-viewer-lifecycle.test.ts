import assert from "node:assert/strict";
import { test } from "node:test";
import { startPdfViewer } from "../src/app/read/[...key]/pdf-viewer-lifecycle.ts";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function viewerHarness() {
  const painted = deferred();
  let onPagesInit: (() => void) | null = null;
  const eventBus = {
    on(_name: "pagesinit", listener: () => void, _options: { once: true }) {
      onPagesInit = listener;
    },
    off(_name: "pagesinit", listener: () => void) {
      if (onPagesInit === listener) onPagesInit = null;
    },
  };
  const viewer = {
    pagesCount: 0,
    pagesPromise: painted.promise,
    document: null as object | null,
    setDocument(document: object) {
      this.document = document;
    },
  };
  return {
    viewer,
    eventBus,
    painted,
    pagesInit() {
      viewer.pagesCount = 3;
      const listener = onPagesInit;
      onPagesInit = null;
      listener?.();
    },
    hasListener() {
      return onPagesInit !== null;
    },
  };
}

test("configure at pagesinit, then wait for the first painted page", async () => {
  const harness = viewerHarness();
  const document = {};
  const order: string[] = [];
  let finished = false;
  const started = startPdfViewer(
    harness.viewer,
    harness.eventBus,
    document,
    3,
    () => order.push("configured"),
  ).then(() => {
    finished = true;
  });

  assert.equal(harness.viewer.document, document);
  assert.deepEqual(order, []);
  harness.pagesInit();
  assert.deepEqual(order, ["configured"]);
  await Promise.resolve();
  assert.equal(finished, false);

  harness.painted.resolve();
  await started;
  assert.equal(finished, true);
  assert.equal(harness.hasListener(), false);
});

test("a viewer that resolves before pagesinit is not declared ready", async () => {
  const harness = viewerHarness();
  const started = startPdfViewer(harness.viewer, harness.eventBus, {}, 3, () =>
    assert.fail("pagesinit did not occur"),
  );
  harness.painted.resolve();
  await assert.rejects(started, /before its page views were ready/);
  assert.equal(harness.hasListener(), false);
});

test("a page initialization failure is propagated", async () => {
  const harness = viewerHarness();
  const started = startPdfViewer(
    harness.viewer,
    harness.eventBus,
    {},
    3,
    () => {},
  );
  harness.painted.reject(new Error("the first page failed"));
  await assert.rejects(started, /the first page failed/);
  assert.equal(harness.hasListener(), false);
});
