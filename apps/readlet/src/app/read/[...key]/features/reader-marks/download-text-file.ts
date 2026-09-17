/** Triggers a client-side download of a UTF-8 text file. */
export function downloadTextFile({
  filename,
  contents,
  mimeType,
}: {
  filename: string;
  contents: string;
  mimeType: string;
}): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
