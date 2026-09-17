import {
  createRemoteJWKSet,
  errors,
  type JWTVerifyGetKey,
  jwtVerify,
} from "jose";

export type AccessIdentity = {
  subject: string;
  email: string;
};

export type AccessConfig = {
  teamDomain: string;
  audience: string;
  bootstrapManagerEmail: string;
};

export class AccessIdentityError extends Error {
  constructor(message = "A valid Cloudflare Access identity is required.") {
    super(message);
    this.name = "AccessIdentityError";
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validatedEmail(value: unknown): string {
  const email = typeof value === "string" ? normalizeEmail(value) : "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : "";
}

/** Authentication is mandatory; an incomplete deployment fails explicitly. */
export function accessConfig(): AccessConfig {
  const teamDomain = process.env.READLET_ACCESS_TEAM_DOMAIN?.trim();
  const audience = process.env.READLET_ACCESS_AUD?.trim();
  const bootstrapManagerEmail = normalizeEmail(
    process.env.READLET_BOOTSTRAP_MANAGER_EMAIL ?? "",
  );
  if (!teamDomain || !audience || !bootstrapManagerEmail) {
    throw new Error(
      "Set READLET_ACCESS_TEAM_DOMAIN, READLET_ACCESS_AUD, and " +
        "READLET_BOOTSTRAP_MANAGER_EMAIL.",
    );
  }
  if (validatedEmail(bootstrapManagerEmail) !== bootstrapManagerEmail) {
    throw new Error(
      "READLET_BOOTSTRAP_MANAGER_EMAIL must be an email address.",
    );
  }

  const url = new URL(teamDomain);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".cloudflareaccess.com") ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "READLET_ACCESS_TEAM_DOMAIN must be a Cloudflare Access HTTPS team domain.",
    );
  }

  return {
    teamDomain: url.origin,
    audience,
    bootstrapManagerEmail,
  };
}

const keys = new Map<string, JWTVerifyGetKey>();

function signingKeys(teamDomain: string): JWTVerifyGetKey {
  let key = keys.get(teamDomain);
  if (!key) {
    key = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    keys.set(teamDomain, key);
  }
  return key;
}

/** Verifies the Access application token and returns only its identity claims. */
export async function accessIdentityForToken(
  token: string | null,
  config: Pick<AccessConfig, "teamDomain" | "audience">,
  key: JWTVerifyGetKey = signingKeys(config.teamDomain),
): Promise<AccessIdentity> {
  if (!token) throw new AccessIdentityError();

  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: config.teamDomain,
      audience: config.audience,
      algorithms: ["RS256"],
    });
    const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
    const email = validatedEmail(payload.email);
    if (!subject || !email) {
      throw new AccessIdentityError();
    }
    return { subject, email };
  } catch (error) {
    if (
      error instanceof AccessIdentityError ||
      error instanceof errors.JOSEAlgNotAllowed ||
      error instanceof errors.JWSInvalid ||
      error instanceof errors.JWSSignatureVerificationFailed ||
      error instanceof errors.JWKSNoMatchingKey ||
      error instanceof errors.JWTClaimValidationFailed ||
      error instanceof errors.JWTExpired ||
      error instanceof errors.JWTInvalid
    ) {
      throw new AccessIdentityError();
    }
    throw error;
  }
}

export function accessToken(headers: Pick<Headers, "get">): string | null {
  return headers.get("cf-access-jwt-assertion");
}
