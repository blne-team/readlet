"use server";

import { redirect } from "next/navigation";
import { accessConfig } from "@/services/access-identity";
import {
  getServices,
  setupRequired,
  storageProvider,
} from "@/services/container";
import { pageIdentity } from "@/services/session";

export type SetupState = {
  status: "idle" | "waiting" | "error";
  message?: string;
};

export async function checkLibraryConnection(
  _previous: SetupState,
  _form: FormData,
): Promise<SetupState> {
  const identity = await pageIdentity();
  const config = accessConfig();
  if (identity.email !== config.bootstrapManagerEmail) {
    redirect("/access-denied");
  }
  if (storageProvider() !== "r2") {
    redirect("/");
  }

  if (await setupRequired()) {
    return {
      status: "waiting",
      message:
        "Readlet cannot see the BOOKS binding yet. Check its name, save the Worker settings, wait a few seconds, and try again.",
    };
  }

  try {
    const { users } = await getServices();
    await users.resolve(identity, config.bootstrapManagerEmail);
  } catch {
    return {
      status: "error",
      message:
        "The BOOKS binding exists, but Readlet could not read and write the bucket. Confirm that it points to the intended R2 bucket and try again.",
    };
  }

  redirect("/");
}
