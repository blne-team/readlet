"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { installReadlet, type SetupState } from "@/app/setup/actions";
import { BUTTON_PRIMARY, INPUT, SELECT } from "@/app/ui";

const INITIAL_SETUP_STATE: SetupState = { status: "idle" };

function FieldError({ children }: { children?: string }) {
  return children ? (
    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{children}</p>
  ) : null;
}

export function SetupForm() {
  const [state, action, pending] = useActionState(
    installReadlet,
    INITIAL_SETUP_STATE,
  );

  if (state.status === "complete") {
    return (
      <div className="mt-10 rounded-3xl border border-separator bg-surface p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto size-10 text-green-600 dark:text-green-400" />
        <h2 className="mt-4 text-xl font-semibold">Your library is ready</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">
          Cloudflare may take a few seconds to activate the new binding. Your
          first visit creates the manager account in the private bucket.
        </p>
        <a href="/" className={`${BUTTON_PRIMARY} mt-6`}>
          Open Readlet
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="mt-10 space-y-6" autoComplete="off">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Cloudflare account ID</span>
          <input
            name="accountId"
            className={`${INPUT} mt-2 w-full font-mono`}
            maxLength={32}
            spellCheck={false}
            required
            aria-invalid={!!state.errors?.accountId}
          />
          <FieldError>{state.errors?.accountId}</FieldError>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Worker name</span>
          <input
            name="workerName"
            className={`${INPUT} mt-2 w-full font-mono`}
            placeholder="readlet"
            maxLength={63}
            spellCheck={false}
            required
            aria-invalid={!!state.errors?.workerName}
          />
          <FieldError>{state.errors?.workerName}</FieldError>
        </label>

        <label className="block">
          <span className="text-sm font-medium">R2 bucket name</span>
          <input
            name="bucketName"
            className={`${INPUT} mt-2 w-full font-mono`}
            placeholder="my-readlet-books"
            minLength={3}
            maxLength={63}
            pattern="[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])"
            spellCheck={false}
            required
            aria-invalid={!!state.errors?.bucketName}
          />
          <FieldError>{state.errors?.bucketName}</FieldError>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Data jurisdiction</span>
          <select
            name="jurisdiction"
            defaultValue="default"
            className={`${SELECT} mt-2 w-full`}
            aria-invalid={!!state.errors?.jurisdiction}
          >
            <option value="default">Automatic placement</option>
            <option value="eu">European Union</option>
            <option value="us">United States</option>
            <option value="fedramp">FedRAMP</option>
            <option value="fedramp-high">FedRAMP High</option>
          </select>
          <FieldError>{state.errors?.jurisdiction}</FieldError>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">One-time API token</span>
        <input
          type="password"
          name="apiToken"
          className={`${INPUT} mt-2 w-full font-mono`}
          spellCheck={false}
          required
          aria-invalid={!!state.errors?.apiToken}
        />
        <p className="mt-2 text-sm leading-6 text-secondary">
          Scope it to this account with Workers Scripts Write and Workers R2
          Storage Write. Readlet sends it directly to Cloudflare and does not
          store it.
        </p>
        <FieldError>{state.errors?.apiToken}</FieldError>
      </label>

      {state.message && (
        <p
          className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          role="alert"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_PRIMARY} w-full disabled:cursor-wait disabled:opacity-60 sm:w-auto`}
      >
        {pending && <LoaderCircle className="mr-2 size-4 animate-spin" />}
        {pending ? "Creating library…" : "Create private library"}
      </button>
    </form>
  );
}
