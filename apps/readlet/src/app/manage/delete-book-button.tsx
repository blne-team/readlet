"use client";

import { useFormStatus } from "react-dom";

export function DeleteBookButton({
  title,
  retry = false,
}: {
  title: string;
  retry?: boolean;
}) {
  const { pending } = useFormStatus();
  const label = retry ? "Finish deletion" : "Delete";

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (
          !retry &&
          !window.confirm(
            `Delete “${title}”, all of its files, and its saved reading state?`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className="inline-flex min-h-11 items-center justify-center rounded-full px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}
