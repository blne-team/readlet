import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { resetLibrary } from "@/app/settings/actions";
import { ResetLibraryButton } from "@/app/settings/reset-library-button";
import { INPUT } from "@/app/ui";

export function ResetLibraryForm() {
  return (
    <details className="group mt-5">
      <summary className="inline-flex min-h-11 list-none items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 [&::-webkit-details-marker]:hidden">
        Configure reset
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform group-open:rotate-180"
        />
      </summary>

      <form
        action={resetLibrary}
        className="mt-5 rounded-2xl bg-red-500/6 p-4 sm:p-5 dark:bg-red-500/10"
      >
        <div className="flex gap-3">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400"
          />
          <div>
            <h3 className="font-semibold">Confirm a full reset</h3>
            <p className="mt-1 text-sm leading-6 text-secondary">
              Readlet can only guarantee a complete reset. The following data
              will be permanently removed:
            </p>
          </div>
        </div>

        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          {[
            ["Library content", "Books, covers, and catalog data"],
            ["Reader activity", "Progress, bookmarks, and highlights"],
            ["People and access", "Users and OPDS app passwords"],
          ].map(([title, description]) => (
            <li key={title} className="rounded-xl bg-surface p-3">
              <div className="flex items-center gap-2 font-medium">
                <Check
                  aria-hidden="true"
                  className="size-4 text-red-600 dark:text-red-400"
                />
                {title}
              </div>
              <p className="mt-1 pl-6 text-xs leading-5 text-secondary">
                {description}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm leading-6 text-secondary">
          The Cloudflare bucket binding remains connected. Your bootstrap
          manager account is recreated so you can sign back in.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acknowledgement"
            value="understood"
            required
            className="mt-0.5 size-4 accent-red-600"
          />
          <span>I understand that this reset cannot be undone.</span>
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="text-sm font-medium">
              Type <span className="font-mono">RESET</span> to continue
            </span>
            <input
              name="confirmation"
              autoComplete="off"
              spellCheck={false}
              pattern="RESET"
              required
              className={`${INPUT} mt-2 w-full sm:max-w-xs`}
            />
          </label>
          <ResetLibraryButton />
        </div>
      </form>
    </details>
  );
}
