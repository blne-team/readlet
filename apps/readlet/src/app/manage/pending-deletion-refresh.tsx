"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refresh briefly while the Worker finishes a staged deletion. */
export function PendingDeletionRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 4_000);
    const timeout = window.setTimeout(
      () => window.clearInterval(interval),
      30_000,
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [router]);

  return null;
}
