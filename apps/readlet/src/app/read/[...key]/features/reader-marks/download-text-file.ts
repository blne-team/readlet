/** Triggers a client-side download of a UTF-8 text file. */
export function downloadTextFile({
  filename,
  body,
  mimeType,
}: {
  filename: string;
  body: string;
  mimeType: string;
}): void {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
