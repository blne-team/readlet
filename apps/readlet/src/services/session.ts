import type { User } from "@readlet/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  type AccessIdentity,
  AccessIdentityError,
} from "@/services/access-identity";
import { identityForHeaders, userForHeaders } from "@/services/request-user";
import { UserAccessError } from "@/services/users";

export const currentIdentity = cache(
  async (): Promise<AccessIdentity> => identityForHeaders(await headers()),
);

/** The authenticated and admitted user for the current server render. */
export const currentUser = cache(
  async (): Promise<User> => userForHeaders(await headers()),
);

/** Pages redirect denied identities; storage failures still reach the boundary. */
export async function pageUser(): Promise<User> {
  try {
    return await currentUser();
  } catch (error) {
    if (
      error instanceof AccessIdentityError ||
      error instanceof UserAccessError
    ) {
      redirect("/access-denied");
    }
    throw error;
  }
}

export async function requireManager(): Promise<User> {
  const user = await currentUser();
  if (user.role !== "manager") {
    throw new UserAccessError("Manager access is required.");
  }
  return user;
}
