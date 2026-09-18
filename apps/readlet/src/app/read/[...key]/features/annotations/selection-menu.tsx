"use client";

import { StickyNote, X } from "lucide-react";
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
  const savingRef = useRef(false);

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

  const save = async (chosen: HighlightColor, text?: string) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      const saved = await onSave(chosen, text);
      if (!saved) setSaveFailed(true);
    } catch {
      setSaveFailed(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const menuHeight = addingNote ? 300 : 110;
  const point = passage.point;
  const showAbove = Boolean(
    point &&
      window.innerHeight - point.y < menuHeight + 24 &&
      point.y > menuHeight,
  );
  const style = desktop
    ? {
        left: Math.min(
          Math.max((point?.x ?? window.innerWidth / 2) - 152, 12),
          Math.max(12, window.innerWidth - 332),
        ),
        top: Math.max(
          12,
          Math.min(
            (point?.y ?? window.innerHeight / 2) +
              (showAbove ? -menuHeight - 10 : 10),
            window.innerHeight - menuHeight - 12,
          ),
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
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void save(color, addingNote ? note.trim() : undefined);
          }
        }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border border-separator bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-page sm:inset-auto sm:w-80 sm:rounded-xl sm:pb-3"
        style={style}
      >
        <div className="flex items-center gap-1">
          <span className="sr-only">Choose a color to save the highlight</span>
          {HIGHLIGHT_COLORS.map((option, index) => (
            <button
              key={option.id}
              ref={index === 0 ? first : undefined}
              type="button"
              title={
                addingNote
                  ? option.label
                  : `Highlight ${option.label.toLowerCase()}`
              }
              aria-label={
                addingNote
                  ? `${option.label} for note`
                  : `Highlight ${option.label.toLowerCase()}`
              }
              aria-pressed={addingNote ? color === option.id : undefined}
              disabled={saving}
              onClick={() => {
                if (addingNote) setColor(option.id);
                else void save(option.id);
              }}
              className={`flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent ${addingNote && color === option.id ? "bg-fill ring-1 ring-inset ring-foreground/30" : ""}`}
            >
              <span
                aria-hidden="true"
                className="size-6 rounded-full border border-black/10"
                style={{ background: option.fill }}
              />
            </button>
          ))}
          <span
            aria-hidden="true"
            className="mx-0.5 h-6 border-l border-separator"
          />
          <button
            type="button"
            title="Add a note"
            aria-label="Add a note"
            aria-expanded={addingNote}
            disabled={saving}
            onClick={() => setAddingNote(true)}
            className={`flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent ${addingNote ? "bg-fill text-accent" : "text-secondary"}`}
          >
            <StickyNote aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            title="Cancel"
            aria-label="Cancel"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-fill hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {saving && !addingNote && (
          <p role="status" className="mt-1 text-center text-xs text-secondary">
            Saving highlight…
          </p>
        )}

        {addingNote && (
          <div className="mt-2 border-t border-separator pt-3">
            <p className="line-clamp-2 border-l-2 border-accent/50 pl-2 text-sm text-secondary">
              {passage.text}
            </p>
            <label
              className="mt-3 block text-xs font-medium"
              htmlFor="selection-note"
            >
              Note
            </label>
            <textarea
              id="selection-note"
              ref={noteField}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_MARK_NOTE_LENGTH}
              rows={3}
              placeholder="Add a thought about this passage…"
              className="mt-1.5 w-full resize-y rounded-lg border border-separator bg-background p-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(color, note.trim())}
              className="mt-2 min-h-10 w-full rounded-lg bg-accent px-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save highlight and note"}
            </button>
          </div>
        )}
        {saveFailed && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            Could not save this highlight. Please try again.
          </p>
        )}
      </div>
    </>
  );
}
