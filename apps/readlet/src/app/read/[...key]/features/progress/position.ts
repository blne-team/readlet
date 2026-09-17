"use client";

import type { BookProgress } from "@readlet/core";
import { useCallback, useEffect, useRef } from "react";

export type ReadingPosition = Omit<BookProgress, "updatedAt">;

const SYNC_DEBOUNCE_MS = 4000;

export type Position = {
  current: () => BookProgress | null;
  record: (position: ReadingPosition) => void;
};

/** Keeps the session's current location and debounces user-state sync. */
export function useReadingPosition({
  bookId,
  saved,
  canSync,
}: {
  bookId: string;
  saved: BookProgress | null;
  canSync: boolean;
}): Position {
  const currentPosition = useRef<BookProgress | null>(saved);
  const pending = useRef<ReadingPosition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentPosition.current = saved;
    pending.current = null;
  }, [saved]);

  const sync = useCallback(
    (beacon: boolean) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const position = pending.current;
      if (!position || !canSync) return;
      pending.current = null;
      const body = JSON.stringify({ bookId, ...position });
      if (beacon) {
        const sent = navigator.sendBeacon(
          "/api/progress",
          new Blob([body], { type: "application/json" }),
        );
        if (!sent) pending.current = position;
        return;
      }
      void fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      })
        .then(async (response) => {
          if (!response.ok) return false;
          const result = (await response.json()) as { saved?: boolean };
          return result.saved === true;
        })
        .then(
          (saved) => {
            if (!saved && !pending.current) pending.current = position;
          },
          () => {
            if (!pending.current) pending.current = position;
          },
        );
    },
    [bookId, canSync],
  );

  useEffect(() => {
    const flush = () => sync(true);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [sync]);

  const current = useCallback(() => currentPosition.current, []);
  const record = useCallback(
    (position: ReadingPosition) => {
      currentPosition.current = {
        ...position,
        updatedAt: new Date().toISOString(),
      };
      if (!canSync) return;
      pending.current = position;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => sync(false), SYNC_DEBOUNCE_MS);
    },
    [canSync, sync],
  );

  return { current, record };
}
