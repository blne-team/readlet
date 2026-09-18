"use client";

import { Highlighter, MessageSquarePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  onNote: (mark: HighlightMark, note: string) => Promise<boolean>;
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
  onNote: (mark: HighlightMark, note: string) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [note, setNote] = useState(mark.note ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const cancelling = useRef(false);
  const savingRef = useRef(false);
  useEffect(() => setNote(mark.note ?? ""), [mark.note]);
  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const saveNote = async () => {
    if (savingRef.current) return;
    const next = note.trim();
    if (next === (mark.note ?? "")) {
      setEditing(false);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    const saved = await onNote(mark, next).catch(() => false);
    savingRef.current = false;
    setSaving(false);
    if (saved) setEditing(false);
    else setSaveFailed(true);
  };
  return (
    <li className="rounded-xl border border-separator p-3 transition-colors hover:bg-fill/40">
      <button
        type="button"
        onClick={() => onGo(mark)}
        className="flex w-full items-start gap-2 text-left text-sm hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Highlighter
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0"
          style={{ color: highlightFill(mark.color) }}
        />
        <span className="line-clamp-3">{mark.text || "Highlight"}</span>
      </button>
      {editing ? (
        <fieldset
          className="mt-3 space-y-2"
          onBlur={(event) => {
            if (
              !cancelling.current &&
              !event.currentTarget.contains(event.relatedTarget)
            )
              void saveNote();
          }}
        >
          <label className="sr-only" htmlFor={`note-${mark.id}`}>
            Note for highlight
          </label>
          <textarea
            id={`note-${mark.id}`}
            ref={field}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                cancelling.current = true;
                setNote(mark.note ?? "");
                setEditing(false);
              }
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                event.stopPropagation();
                void saveNote();
              }
            }}
            maxLength={MAX_MARK_NOTE_LENGTH}
            disabled={saving}
            rows={3}
            placeholder="Add a note…"
            className={`${INPUT} w-full resize-y`}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveNote()}
            className="text-xs font-medium text-accent disabled:opacity-60"
          >
            {saving ? "Saving…" : "Done"}
          </button>
          {saveFailed && (
            <p role="alert" className="text-xs text-red-600">
              Could not save this note. Please try again.
            </p>
          )}
        </fieldset>
      ) : mark.note ? (
        <button
          type="button"
          disabled={!writable}
          onClick={() => {
            cancelling.current = false;
            setEditing(true);
          }}
          className="mt-3 block w-full whitespace-pre-wrap rounded-lg bg-fill px-3 py-2 text-left text-sm disabled:cursor-default"
        >
          {mark.note}
        </button>
      ) : writable ? (
        <button
          type="button"
          onClick={() => {
            cancelling.current = false;
            setEditing(true);
          }}
          className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-xs text-secondary hover:text-accent"
        >
          <MessageSquarePlus aria-hidden="true" className="size-3.5" />
          Add note
        </button>
      ) : null}
      {writable && !editing && (
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
