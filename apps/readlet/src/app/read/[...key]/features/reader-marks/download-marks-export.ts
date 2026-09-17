import { downloadTextFile } from "./download-text-file";
import {
  type MarksExport,
  marksExportFilename,
  serializeMarksJson,
  serializeMarksMarkdown,
} from "./export-marks";

export function downloadMarksExport(
  input: MarksExport,
  format: "json" | "md",
): void {
  downloadTextFile({
    filename: marksExportFilename(input.bookId, format),
    contents:
      format === "json"
        ? serializeMarksJson(input)
        : serializeMarksMarkdown(input),
    mimeType:
      format === "json" ? "application/json" : "text/markdown;charset=utf-8",
  });
}
