"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accessConfig } from "@/services/access-identity";
import { getServices } from "@/services/container";
import { pageIdentity, requireManager } from "@/services/session";

export async function deleteBook(form: FormData): Promise<void> {
  const actor = await requireManager();
  const id = form.get("id");
  if (typeof id !== "string" || !id) throw new Error("A book id is required.");

  const { library, defer } = await getServices();
  if (form.get("retry") === "1") {
    await library.finishBookDeletion(actor, id);
  } else {
    await library.beginBookDeletion(actor, id);
    const cleanup = library.finishBookDeletion(actor, id);
    if (defer) {
      defer(
        cleanup.catch((error: unknown) => {
          console.error(`Could not finish deleting book ${id}:`, error);
        }),
      );
    } else {
      await cleanup;
    }
  }
  revalidatePath("/");
  revalidatePath("/manage");
  redirect("/manage");
}

export async function resetLibrary(form: FormData): Promise<void> {
  const [actor, identity] = await Promise.all([
    requireManager(),
    pageIdentity(),
  ]);
  if (form.get("confirmation") !== "RESET") {
    throw new Error('Type "RESET" to confirm the library reset.');
  }
  const { bootstrapManagerEmail } = accessConfig();
  const { library } = await getServices();
  await library.reset(actor, identity, bootstrapManagerEmail);

  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath("/users");
  revalidatePath("/resources");
  redirect("/manage");
}
