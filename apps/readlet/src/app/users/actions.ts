"use server";

import type { UserRole } from "@readlet/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServices } from "@/services/container";
import { requireManager } from "@/services/session";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function role(form: FormData): UserRole {
  const value = text(form, "role");
  if (value !== "manager" && value !== "member") {
    throw new Error("Choose a valid role.");
  }
  return value;
}

function changed(): never {
  revalidatePath("/");
  revalidatePath("/users");
  redirect("/users");
}

export async function inviteUser(form: FormData): Promise<void> {
  const actor = await requireManager();
  const { users } = await getServices();
  await users.invite(actor, {
    email: text(form, "email"),
    displayName: text(form, "displayName"),
    role: role(form),
  });
  changed();
}

export async function updateUser(form: FormData): Promise<void> {
  const actor = await requireManager();
  const { users } = await getServices();
  await users.update(actor, text(form, "id"), {
    displayName: text(form, "displayName"),
    role: role(form),
  });
  changed();
}

export async function setUserEnabled(form: FormData): Promise<void> {
  const actor = await requireManager();
  const { users } = await getServices();
  const enabled = text(form, "enabled");
  if (enabled !== "true" && enabled !== "false") {
    throw new Error("Choose a valid access state.");
  }
  await users.setEnabled(actor, text(form, "id"), enabled === "true");
  changed();
}

export async function rebindUser(form: FormData): Promise<void> {
  const actor = await requireManager();
  const { users } = await getServices();
  await users.rebind(actor, text(form, "id"));
  changed();
}

export async function deleteUser(form: FormData): Promise<void> {
  const actor = await requireManager();
  const { users } = await getServices();
  await users.remove(actor, text(form, "id"));
  changed();
}
