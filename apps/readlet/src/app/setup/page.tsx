import { Cloud } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetupForm } from "@/app/setup/setup-form";
import { accessConfig } from "@/services/access-identity";
import { setupRequired, storageProvider } from "@/services/container";
import { pageIdentity } from "@/services/session";

export const metadata: Metadata = {
  title: "Set up Readlet",
  robots: { index: false, follow: false },
};

export default async function SetupPage() {
  if (storageProvider() !== "r2" || !(await setupRequired())) redirect("/");

  const identity = await pageIdentity();
  if (identity.email !== accessConfig().bootstrapManagerEmail) {
    redirect("/access-denied");
  }

  return (
    <main className="page-safe mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Cloud className="size-6" />
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Connect your private library
      </h1>
      <p className="mt-3 max-w-xl leading-7 text-secondary">
        Readlet will create a private R2 bucket and attach it to this Worker as
        the BOOKS binding. The bucket will not receive a public URL.
      </p>

      <SetupForm />
    </main>
  );
}
