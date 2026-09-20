import type { User } from "@readlet/core";
import { SITE_NAME } from "@/lib/site";
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

function opdsUnauthorized(request: Request): Response {
  const authentication = new URL("/opds/auth", request.url).toString();
  return Response.json(
    {
      id: authentication,
      title: SITE_NAME,
      authentication: [
        {
          type: "http://opds-spec.org/auth/basic",
          labels: { login: "Username", password: "App password" },
        },
      ],
    },
    {
      status: 401,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/opds-authentication+json; charset=utf-8",
        link: `<${authentication}>; rel="http://opds-spec.org/auth/document"; type="application/opds-authentication+json"`,
        "www-authenticate": `Basic realm="${SITE_NAME} OPDS", charset="UTF-8"`,
      },
    },
  );
}

export function opdsAuthenticationDocument(request: Request): Response {
  const response = opdsUnauthorized(request);
  const headers = new Headers(response.headers);
  headers.delete("www-authenticate");
  return new Response(response.body, {
    headers,
  });
}

/** Cloudflare sessions for browsers, or a scoped app password for readers. */
export async function opdsRouteUser(
  request: Request,
): Promise<User | Response> {
  const authorization = request.headers.get("authorization");
  const basic = authorization?.match(/^Basic\s+(.+)$/i);
  if (basic) {
    try {
      const decoded = atob(basic[1]);
      const separator = decoded.indexOf(":");
      if (separator === -1) return opdsUnauthorized(request);
      const { users } = await getServices();
      return await users.authenticateOpds(
        decoded.slice(0, separator),
        decoded.slice(separator + 1),
      );
    } catch (error) {
      if (error instanceof UserAccessError || error instanceof DOMException) {
        return opdsUnauthorized(request);
      }
      throw error;
    }
  }

  const user = await routeUser(request);
  return user instanceof Response && user.status === 401
    ? opdsUnauthorized(request)
    : user;
}
