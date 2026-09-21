import {
  STATE_VERSION,
  USERS_FILE,
  type User,
  type UserDirectory,
} from "@readlet/core";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const TEAM_DOMAIN = "https://readlet-tests.cloudflareaccess.com";
const AUDIENCE = "readlet-test-app";
const TEST_SUBJECT = "cf-test-reader";

export const TEST_USER: User = {
  id: "u-test",
  accessSubject: TEST_SUBJECT,
  email: "reader@example.com",
  displayName: "Reader",
  role: "member",
  status: "active",
  createdAt: new Date(0).toISOString(),
  createdBy: "u-test",
};

export function userDirectory(): Record<string, string> {
  return {
    [USERS_FILE]: JSON.stringify({
      version: STATE_VERSION,
      users: [TEST_USER],
    } satisfies UserDirectory),
  };
}

/** Real signed Access tokens and a local JWKS endpoint for route tests. */
export async function startAccessFixture(): Promise<{
  token: string;
  tokenFor(subject: string, email: string): Promise<string>;
  serviceTokenFor(clientId: string): Promise<string>;
  stop(): void;
}> {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "readlet-test-key";
  jwk.alg = "RS256";
  jwk.use = "sig";

  const tokenFor = (subject: string, email: string) =>
    new SignJWT({ email })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(TEAM_DOMAIN)
      .setAudience(AUDIENCE)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
  const token = await tokenFor(TEST_SUBJECT, TEST_USER.email);
  const serviceTokenFor = (clientId: string) =>
    new SignJWT({ common_name: clientId })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(TEAM_DOMAIN)
      .setAudience(AUDIENCE)
      .setSubject("")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

  const previousFetch = globalThis.fetch;
  const previousDomain = process.env.READLET_ACCESS_TEAM_DOMAIN;
  const previousAudience = process.env.READLET_ACCESS_AUD;
  const previousManager = process.env.READLET_BOOTSTRAP_MANAGER_EMAIL;

  process.env.READLET_ACCESS_TEAM_DOMAIN = TEAM_DOMAIN;
  process.env.READLET_ACCESS_AUD = AUDIENCE;
  process.env.READLET_BOOTSTRAP_MANAGER_EMAIL = "manager@example.com";
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === `${TEAM_DOMAIN}/cdn-cgi/access/certs`) {
      return Promise.resolve(Response.json({ keys: [jwk] }));
    }
    return previousFetch(input, init);
  }) as typeof fetch;

  return {
    token,
    tokenFor,
    serviceTokenFor,
    stop() {
      globalThis.fetch = previousFetch;
      restore("READLET_ACCESS_TEAM_DOMAIN", previousDomain);
      restore("READLET_ACCESS_AUD", previousAudience);
      restore("READLET_BOOTSTRAP_MANAGER_EMAIL", previousManager);
    },
  };
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
