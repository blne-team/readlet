"use client";

import { useEffect, useRef, useState } from "react";
import {
  type HighlightAnchor,
  MAX_MARK_NOTE_LENGTH,
} from "@/domain/reader-marks";
import { HIGHLIGHT_COLORS, type HighlightColor } from "./highlight-colors";

export type SelectedPassage = {
  anchor: HighlightAnchor;
  text: string;
  point?: { x: number; y: number };
};

export function SelectionMenu({
  passage,
  onSave,
  onClose,
}: {
  passage: SelectedPassage;
  onSave: (color: HighlightColor, note?: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [color, setColor] = useState<HighlightColor>("yellow");
  const [addingNote, setAddingNote] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const noteField = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (desktop) first.current?.focus();
  }, [desktop]);
  useEffect(() => {
    if (addingNote) noteField.current?.focus();
  }, [addingNote]);
  const style = desktop
    ? {
        left: Math.min(
          Math.max((passage.point?.x ?? window.innerWidth / 2) - 160, 12),
          window.innerWidth - 332,
        ),
        top: Math.min(
          Math.max((passage.point?.y ?? window.innerHeight / 2) + 12, 12),
          Math.max(12, window.innerHeight - (addingNote ? 380 : 260)),
        ),
      }
    : undefined;

  return (
    <>
      <button
        type="button"
        aria-label="Cancel selected text"
        onClick={onClose}
        className="fixed inset-0 z-40 hidden sm:block"
      />
      <div
        role="dialog"
        aria-modal={desktop}
        aria-label="Highlight selected text"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border border-separator bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-page sm:inset-auto sm:w-80 sm:rounded-xl sm:pb-4"
        style={style}
      >
        <p className="line-clamp-2 text-sm text-secondary">“{passage.text}”</p>
        <p className="mt-3 text-xs font-medium">Highlight color</p>
        <fieldset className="mt-2 flex gap-2" aria-label="Highlight color">
          {HIGHLIGHT_COLORS.map((option, index) => (
            <button
              key={option.id}
              ref={index === 0 ? first : undefined}
              type="button"
              aria-label={option.label}
              aria-pressed={color === option.id}
              onClick={() => setColor(option.id)}
              className={`flex size-11 items-center justify-center rounded-full border-2 ${color === option.id ? "border-foreground" : "border-transparent"}`}
            >
              <span
                aria-hidden="true"
                className="size-7 rounded-full"
                style={{ background: option.fill }}
              />
            </button>
          ))}
        </fieldset>
        {addingNote && (
          <label className="mt-3 block text-xs font-medium">
            Note (optional)
            <textarea
              value={note}
              ref={noteField}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_MARK_NOTE_LENGTH}
              rows={3}
              className="mt-2 w-full rounded-lg border border-separator bg-background p-2 text-sm"
            />
          </label>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setSaveFailed(false);
              const saved = await onSave(
                color,
                addingNote ? note.trim() : undefined,
              );
              if (!saved) {
                setSaving(false);
                setSaveFailed(true);
              }
            }}
            className="min-h-11 flex-1 rounded-lg bg-accent px-3 text-sm font-medium text-white"
          >
            {saving
              ? "Saving…"
              : addingNote
                ? "Save highlight and note"
                : "Highlight"}
          </button>
          {!addingNote && (
            <button
              type="button"
              onClick={() => setAddingNote(true)}
              className="min-h-11 rounded-lg border border-separator px-3 text-sm font-medium"
            >
              Add note
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg px-3 text-sm text-secondary"
          >
            Cancel
          </button>
        </div>
        {saveFailed && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            Could not save this highlight. Please try again.
          </p>
        )}
      </div>
    </>
  );
}
