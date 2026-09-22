"use client";

import { useFormStatus } from "react-dom";

export function ResetLibraryButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-red-500 dark:hover:bg-red-600"
    >
      {pending ? "Resetting library…" : "Reset library"}
    </button>
  );
}
