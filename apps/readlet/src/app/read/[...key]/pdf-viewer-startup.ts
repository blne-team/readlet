"use client";

/**
 * Start the viewer module and the document's initial ranged reads together.
 * Both wait on the same configured PDF.js core, but neither needs to wait for
 * the other. If the viewer fails, release a document that did open successfully.
 */
export async function acquirePdfViewerInputs<
  Runtime,
  Opened extends {
    close: () => void;
  },
>(
  loadRuntime: () => Promise<Runtime>,
  openDocument: () => Promise<Opened>,
): Promise<{ runtime: Runtime; opened: Opened }> {
  const [runtime, opened] = await Promise.allSettled([
    loadRuntime(),
    openDocument(),
  ]);
  if (runtime.status === "rejected") {
    if (opened.status === "fulfilled") opened.value.close();
    throw runtime.reason;
  }
  if (opened.status === "rejected") throw opened.reason;
  return { runtime: runtime.value, opened: opened.value };
}
