import { CheckCircle2, Database, LockKeyhole, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManagementHeader } from "@/app/management-header";
import { ResetLibraryForm } from "@/app/settings/reset-library-form";
import { OG_BASE, SITE_DESCRIPTION } from "@/lib/site";
import { accessConfig } from "@/services/access-identity";
import { getServices, storageProvider } from "@/services/container";
import { pageUser } from "@/services/session";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
  openGraph: { ...OG_BASE, title: "Settings", url: "/settings" },
  twitter: {
    card: "summary",
    title: "Settings",
    description: SITE_DESCRIPTION,
  },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string | string[] }>;
}) {
  const actor = await pageUser();
  if (actor.role !== "manager") redirect("/");

  const { reset } = await searchParams;
  const provider = storageProvider();
  const { library } = await getServices();
  const isBootstrapManager =
    actor.email === accessConfig().bootstrapManagerEmail;
  const canReset =
    provider === "r2" && library.resettable && isBootstrapManager;

  const resetUnavailableReason =
    provider !== "r2"
      ? "Full reset is only available for Cloudflare R2 libraries."
      : !library.resettable
        ? "Full reset is disabled while this library is read only."
        : !isBootstrapManager
          ? "Only the configured bootstrap manager can reset this library."
          : null;

  return (
    <main className="page-safe mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <ManagementHeader name={actor.displayName} current="/settings" />

      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-secondary">
        Review this deployment and manage library-wide behavior.
      </p>

      {reset === "complete" && (
        <div
          role="status"
          className="mt-8 flex items-start gap-3 rounded-2xl bg-green-500/10 p-4 text-sm"
        >
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-green-700 dark:text-green-400"
          />
          <div>
            <p className="font-medium">Library reset complete</p>
            <p className="mt-1 text-secondary">
              The previous library data was removed and your manager account is
              ready to use.
            </p>
          </div>
        </div>
      )}

      <section className="mt-10" aria-labelledby="library-settings-heading">
        <div className="flex items-center gap-3">
          <Database aria-hidden="true" className="size-5 text-secondary" />
          <h2 id="library-settings-heading" className="text-xl font-semibold">
            Library
          </h2>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-separator bg-surface">
          <dl className="divide-y divide-separator">
            <div className="grid gap-1 px-4 py-4 sm:grid-cols-[12rem_1fr] sm:px-5">
              <dt className="text-sm font-medium">Storage provider</dt>
              <dd className="text-sm text-secondary sm:text-right">
                {provider === "r2" ? "Cloudflare R2" : "Local filesystem"}
              </dd>
            </div>
            <div className="grid gap-1 px-4 py-4 sm:grid-cols-[12rem_1fr] sm:px-5">
              <dt className="text-sm font-medium">Library access</dt>
              <dd className="text-sm text-secondary sm:text-right">
                {library.writable ? "Read and write" : "Read only"}
              </dd>
            </div>
            <div className="grid gap-1 px-4 py-4 sm:grid-cols-[12rem_1fr] sm:px-5">
              <dt className="text-sm font-medium">Manager identity</dt>
              <dd className="min-w-0 break-words text-sm text-secondary sm:text-right">
                {actor.email}
                {isBootstrapManager ? " · Bootstrap manager" : ""}
              </dd>
            </div>
          </dl>
        </div>
        <p className="mt-3 text-sm leading-6 text-secondary">
          Provider and read-only mode are deployment settings. Change them in
          your Readlet configuration, then redeploy the app.
        </p>
      </section>

      <section
        className="mt-12 border-t border-red-500/25 pt-8"
        aria-labelledby="danger-zone-heading"
      >
        <div className="flex items-center gap-3">
          <RotateCcw
            aria-hidden="true"
            className="size-5 text-red-600 dark:text-red-400"
          />
          <h2
            id="danger-zone-heading"
            className="text-xl font-semibold text-red-700 dark:text-red-400"
          >
            Reset Cloudflare library
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Permanently erase the contents of the bound BOOKS bucket and return
          Readlet to a fresh-library state.
        </p>

        {canReset ? (
          <ResetLibraryForm />
        ) : (
          <div className="mt-5 flex max-w-2xl items-start gap-3 rounded-2xl bg-fill p-4 text-sm">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-secondary"
            />
            <p className="leading-6 text-secondary">{resetUnavailableReason}</p>
          </div>
        )}
      </section>
    </main>
  );
}
