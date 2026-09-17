import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ManagementHeader } from "@/app/management-header";
import { R2UsageCard } from "@/app/resources/r2-usage-card";
import { OG_BASE, SITE_DESCRIPTION } from "@/lib/site";
import { getServices } from "@/services/container";
import { pageUser } from "@/services/session";

export const metadata: Metadata = {
  title: "Resources",
  robots: { index: false, follow: false },
  openGraph: { ...OG_BASE, title: "Resources", url: "/resources" },
  twitter: {
    card: "summary",
    title: "Resources",
    description: SITE_DESCRIPTION,
  },
};

export default async function ResourcesPage() {
  const actor = await pageUser();
  if (actor.role !== "manager") redirect("/");

  const { r2Usage } = await getServices();
  const usage = await r2Usage?.status();

  return (
    <main className="page-safe mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <ManagementHeader name={actor.displayName} current="/resources" />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Resources</h1>
      <p className="mt-2 text-secondary">
        Monitor the storage and request budget for this library.
      </p>

      {usage ? (
        <R2UsageCard status={usage} />
      ) : (
        <p className="mt-10 rounded-2xl border border-separator p-5 text-secondary">
          Resource usage is not available for this storage provider.
        </p>
      )}
    </main>
  );
}
