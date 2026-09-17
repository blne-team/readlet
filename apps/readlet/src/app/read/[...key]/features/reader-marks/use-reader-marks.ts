"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  HighlightAnchor,
  HighlightColor,
  ReaderAnchor,
  ReaderMark,
} from "@/domain/reader-marks";

export function useReaderMarks(bookId: string) {
  const [marks, setMarks] = useState<ReaderMark[]>([]);
  const [writable, setWritable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/reader-marks?bookId=${encodeURIComponent(bookId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your marks.");
        return response.json() as Promise<{
          marks: ReaderMark[];
          writable: boolean;
        }>;
      })
      .then((data) => {
        if (active) {
          setMarks(data.marks);
          setWritable(data.writable);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your marks.",
          );
      });
    return () => {
      active = false;
    };
  }, [bookId]);

  const save = useCallback(
    async (mark: ReaderMark) => {
      setError(null);
      const response = await fetch("/api/reader-marks", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookId, mark }),
      }).catch(() => null);
      if (!response?.ok) {
        setError("Could not save this mark.");
        return false;
      }
      setMarks((current) => [
        mark,
        ...current.filter((item) => item.id !== mark.id),
      ]);
      return true;
    },
    [bookId],
  );

  const createBookmark = useCallback(
    async (anchor: ReaderAnchor, text?: string) => {
      const now = new Date().toISOString();
      return save({
        id: crypto.randomUUID(),
        type: "bookmark",
        anchor,
        text,
        createdAt: now,
        updatedAt: now,
      });
    },
    [save],
  );

  const createHighlight = useCallback(
    async (
      anchor: HighlightAnchor,
      text: string,
      color: HighlightColor,
      note?: string,
    ) => {
      const now = new Date().toISOString();
      return save({
        id: crypto.randomUUID(),
        type: "highlight",
        anchor,
        text,
        color,
        note,
        createdAt: now,
        updatedAt: now,
      });
    },
    [save],
  );

  const remove = useCallback(
    async (id: string) => {
      setError(null);
      const response = await fetch("/api/reader-marks", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookId, id }),
      }).catch(() => null);
      if (!response?.ok) {
        setError("Could not delete this mark.");
        return false;
      }
      setMarks((current) => current.filter((mark) => mark.id !== id));
      return true;
    },
    [bookId],
  );

  return {
    marks,
    writable,
    error,
    createBookmark,
    createHighlight,
    save,
    remove,
  };
}
