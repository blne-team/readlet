"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServices } from "@/services/container";
import { requireManager } from "@/services/session";

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
