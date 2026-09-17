"use client";

import { Highlighter } from "lucide-react";
import { useEffect, useState } from "react";
import { INPUT } from "@/app/ui";
import {
  type HighlightMark,
  MAX_MARK_NOTE_LENGTH,
  type ReaderMark,
} from "@/domain/reader-marks";
import { highlightFill } from "./highlight-colors";

export function AnnotationList({
  marks,
  writable,
  onGo,
  onNote,
  onRemove,
}: {
  marks: HighlightMark[];
  writable: boolean;
  onGo: (mark: ReaderMark) => void;
  onNote: (mark: HighlightMark, note: string) => void;
  onRemove: (id: string) => void;
}) {
  if (marks.length === 0) return null;
  return (
    <section aria-labelledby="highlights-heading">
      <h3
        id="highlights-heading"
        className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary"
      >
        Highlights
      </h3>
      <ul className="space-y-3">
        {marks.map((mark) => (
          <AnnotationRow
            key={mark.id}
            mark={mark}
            writable={writable}
            onGo={onGo}
            onNote={onNote}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  );
}

function AnnotationRow({
  mark,
  writable,
  onGo,
  onNote,
  onRemove,
}: {
  mark: HighlightMark;
  writable: boolean;
  onGo: (mark: ReaderMark) => void;
  onNote: (mark: HighlightMark, note: string) => void;
  onRemove: (id: string) => void;
}) {
  const [note, setNote] = useState(mark.note ?? "");
  useEffect(() => setNote(mark.note ?? ""), [mark.note]);
  return (
    <li className="rounded-lg border border-separator p-3">
      <button
        type="button"
        onClick={() => onGo(mark)}
        className="flex w-full items-start gap-2 text-left text-sm"
      >
        <Highlighter
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0"
          style={{ color: highlightFill(mark.color) }}
        />
        <span className="line-clamp-3">{mark.text || "Highlight"}</span>
      </button>
      <div className="mt-3 space-y-2">
        <label
          className="block text-xs text-secondary"
          htmlFor={`note-${mark.id}`}
        >
          Note (optional)
        </label>
        <textarea
          id={`note-${mark.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_MARK_NOTE_LENGTH}
          disabled={!writable}
          rows={3}
          className={`${INPUT} w-full resize-y`}
        />
        {writable && note !== (mark.note ?? "") && (
          <button
            type="button"
            onClick={() => onNote(mark, note)}
            className="text-xs font-medium text-accent"
          >
            Save note
          </button>
        )}
      </div>
      {writable && (
        <button
          type="button"
          onClick={() => onRemove(mark.id)}
          className="mt-3 text-xs text-secondary hover:text-foreground"
        >
          Delete
        </button>
      )}
    </li>
  );
}
