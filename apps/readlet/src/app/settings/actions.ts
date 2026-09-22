"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accessConfig } from "@/services/access-identity";
import { getServices } from "@/services/container";
import { pageIdentity, requireManager } from "@/services/session";

export async function resetLibrary(form: FormData): Promise<void> {
  const [actor, identity] = await Promise.all([
    requireManager(),
    pageIdentity(),
  ]);

  if (form.get("acknowledgement") !== "understood") {
    throw new Error("Confirm that you understand what the reset removes.");
  }
  if (form.get("confirmation") !== "RESET") {
    throw new Error('Type "RESET" to confirm the library reset.');
  }

  const { bootstrapManagerEmail } = accessConfig();
  const { library } = await getServices();
  await library.reset(actor, identity, bootstrapManagerEmail);

  for (const path of ["/", "/manage", "/users", "/resources", "/settings"]) {
    revalidatePath(path);
  }
  redirect("/settings?reset=complete");
}
