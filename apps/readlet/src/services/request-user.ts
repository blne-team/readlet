import type { User } from "@readlet/core";
import {
  type AccessIdentity,
  AccessIdentityError,
  accessConfig,
  accessIdentityForToken,
  accessToken,
} from "@/services/access-identity";
import { getServices } from "@/services/container";
import { UserAccessError } from "@/services/users";

const LOCAL_DEVELOPMENT_IDENTITY: AccessIdentity = {
  subject: "readlet-local-development",
  email: "developer@readlet.local",
};

const LOCAL_DEVELOPMENT_USER: User = {
  id: "u-00000000-0000-4000-8000-000000000000",
  accessSubject: LOCAL_DEVELOPMENT_IDENTITY.subject,
  email: LOCAL_DEVELOPMENT_IDENTITY.email,
  displayName: "Local developer",
  role: "member",
  status: "active",
  createdAt: new Date(0).toISOString(),
  createdBy: "u-00000000-0000-4000-8000-000000000000",
};

/**
 * An explicit convenience for `next dev`, never an authentication mode a
 * built server or Worker can enter. The synthetic user is not written into the
 * library's real user directory, so local browsing cannot claim or poison a
 * production Cloudflare identity.
 */
function localDevelopmentAuth(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.READLET_DEV_AUTH_BYPASS === "1"
  );
}

export async function identityForHeaders(
  incoming: Pick<Headers, "get">,
): Promise<AccessIdentity> {
  if (localDevelopmentAuth()) return LOCAL_DEVELOPMENT_IDENTITY;
  return (await verifiedIdentity(incoming)).identity;
}

export async function userForHeaders(
  incoming: Pick<Headers, "get">,
): Promise<User> {
  if (localDevelopmentAuth()) return LOCAL_DEVELOPMENT_USER;
  const { config, identity } = await verifiedIdentity(incoming);
  const { users } = await getServices();
  return users.resolve(identity, config.bootstrapManagerEmail);
}

async function verifiedIdentity(incoming: Pick<Headers, "get">) {
  const token = accessToken(incoming);
  if (!token) throw new AccessIdentityError();

  const config = accessConfig();
  return { config, identity: await accessIdentityForToken(token, config) };
}

/** Route handlers use this result before reading any private data or cache. */
export async function routeUser(request: Request): Promise<User | Response> {
  try {
    return await userForHeaders(request.headers);
  } catch (error) {
    if (error instanceof AccessIdentityError) {
      return Response.json(
        { error: error.message },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    if (error instanceof UserAccessError) {
      return Response.json(
        { error: error.message },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    throw error;
  }
}
