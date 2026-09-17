"use client";

export function DeleteButton({
  email,
  deleting,
}: {
  email: string;
  deleting: boolean;
}) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (
          !deleting &&
          !window.confirm(
            `Delete ${email} and all of this user's reading state?`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className="inline-flex min-h-11 items-center justify-center rounded-full px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
    >
      {deleting ? "Finish deletion" : "Delete"}
    </button>
  );
}
