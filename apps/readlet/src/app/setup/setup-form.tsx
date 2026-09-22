"use client";

import { ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { checkLibraryConnection, type SetupState } from "@/app/setup/actions";
import { BUTTON, BUTTON_PRIMARY } from "@/app/ui";

const INITIAL_SETUP_STATE: SetupState = { status: "idle" };

export function SetupForm() {
  const [state, action, pending] = useActionState(
    checkLibraryConnection,
    INITIAL_SETUP_STATE,
  );

  return (
    <div className="mt-10 space-y-8">
      <ol className="space-y-6">
        <li className="rounded-3xl border border-separator bg-surface p-5 sm:p-6">
          <p className="font-semibold">1. Create a private R2 bucket</p>
          <p className="mt-2 text-sm leading-6 text-secondary">
            In the Cloudflare dashboard, open R2 Object Storage, create a
            Standard bucket, and leave its public development URL and custom
            domains disabled.
          </p>
        </li>
        <li className="rounded-3xl border border-separator bg-surface p-5 sm:p-6">
          <p className="font-semibold">2. Attach it to this Worker</p>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Open this Worker&apos;s Settings and add an R2 bucket binding. Set
            the variable name to <code className="font-mono">BOOKS</code>,
            select the bucket you created, and save the change.
          </p>
        </li>
        <li className="rounded-3xl border border-separator bg-surface p-5 sm:p-6">
          <p className="font-semibold">3. Verify the connection</p>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Return here after saving. Readlet will detect the binding, test the
            bucket, and initialize your manager account.
          </p>
        </li>
      </ol>

      <p className="rounded-2xl bg-accent/10 px-4 py-3 text-sm leading-6 text-secondary">
        You do not need to paste a bucket name, connection string, access key,
        or API token here. The <code className="font-mono">BOOKS</code> binding
        is the connection and keeps credentials out of Readlet.
      </p>

      <div className="flex flex-wrap gap-3">
        <a
          href="https://dash.cloudflare.com/"
          target="_blank"
          rel="noreferrer"
          className={`${BUTTON} inline-flex items-center gap-2`}
        >
          Open Cloudflare
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className={`${BUTTON_PRIMARY} disabled:cursor-wait disabled:opacity-60`}
          >
            {pending ? (
              <LoaderCircle
                aria-hidden="true"
                className="mr-2 size-4 animate-spin"
              />
            ) : (
              <RefreshCw aria-hidden="true" className="mr-2 size-4" />
            )}
            {pending ? "Checking…" : "Check connection"}
          </button>
        </form>
      </div>

      {state.message && (
        <p
          className={
            state.status === "error"
              ? "rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
              : "rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
          }
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
