import type { JWTPayload } from "jose";
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

export class AccessServiceError extends Error {
  constructor(
    message = "A valid Cloudflare Access service token is required.",
  ) {
    super(message);
    this.name = "AccessServiceError";
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
  try {
    const payload = await verifiedPayload(token, config, key);
    const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
    const email = validatedEmail(payload.email);
    if (!subject || !email) {
      throw new AccessIdentityError();
    }
    return { subject, email };
  } catch (error) {
    if (error instanceof AccessIdentityError || isInvalidAccessToken(error)) {
      throw new AccessIdentityError();
    }
    throw error;
  }
}

async function verifiedPayload(
  token: string | null,
  config: Pick<AccessConfig, "teamDomain" | "audience">,
  key: JWTVerifyGetKey,
): Promise<JWTPayload> {
  if (!token) throw new errors.JWTInvalid();
  return (
    await jwtVerify(token, key, {
      issuer: config.teamDomain,
      audience: config.audience,
      algorithms: ["RS256"],
    })
  ).payload;
}

export async function accessServiceForToken(
  token: string | null,
  config: Pick<AccessConfig, "teamDomain" | "audience">,
  key: JWTVerifyGetKey = signingKeys(config.teamDomain),
): Promise<string> {
  try {
    const payload = await verifiedPayload(token, config, key);
    const clientId =
      typeof payload.common_name === "string" ? payload.common_name.trim() : "";
    if (!clientId || payload.sub) throw new AccessServiceError();
    return clientId;
  } catch (error) {
    if (error instanceof AccessServiceError || isInvalidAccessToken(error)) {
      throw new AccessServiceError();
    }
    throw error;
  }
}

function isInvalidAccessToken(error: unknown): boolean {
  return (
    error instanceof errors.JOSEAlgNotAllowed ||
    error instanceof errors.JWSInvalid ||
    error instanceof errors.JWSSignatureVerificationFailed ||
    error instanceof errors.JWKSNoMatchingKey ||
    error instanceof errors.JWTClaimValidationFailed ||
    error instanceof errors.JWTExpired ||
    error instanceof errors.JWTInvalid
  );
}

export function accessToken(headers: Pick<Headers, "get">): string | null {
  return headers.get("cf-access-jwt-assertion");
}
