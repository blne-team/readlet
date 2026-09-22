"use server";

import { redirect } from "next/navigation";
import { accessConfig } from "@/services/access-identity";
import {
  ProvisioningError,
  type ProvisioningValidation,
  provisionCloudflare,
  validateProvisioningInput,
} from "@/services/cloudflare-provisioning";
import { setupRequired, storageProvider } from "@/services/container";
import { pageIdentity } from "@/services/session";

export type SetupState = {
  status: "idle" | "error" | "complete";
  message?: string;
  errors?: ProvisioningValidation;
};

export async function installReadlet(
  _previous: SetupState,
  form: FormData,
): Promise<SetupState> {
  const identity = await pageIdentity();
  if (identity.email !== accessConfig().bootstrapManagerEmail) {
    redirect("/access-denied");
  }
  if (storageProvider() !== "r2" || !(await setupRequired())) {
    redirect("/");
  }

  const parsed = validateProvisioningInput({
    accountId: form.get("accountId") ?? undefined,
    workerName: form.get("workerName") ?? undefined,
    bucketName: form.get("bucketName") ?? undefined,
    jurisdiction: form.get("jurisdiction") ?? undefined,
    apiToken: form.get("apiToken") ?? undefined,
  });
  if (!parsed.input) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      errors: parsed.errors,
    };
  }

  try {
    await provisionCloudflare(parsed.input);
    return { status: "complete" };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof ProvisioningError
          ? error.message
          : "Readlet could not complete the Cloudflare setup.",
    };
  }
}
