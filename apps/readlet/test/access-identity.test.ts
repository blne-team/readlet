import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPair, type JWTVerifyGetKey, SignJWT } from "jose";
import {
  AccessIdentityError,
  accessIdentityForToken,
} from "../src/services/access-identity.ts";

const config = {
  teamDomain: "https://example.cloudflareaccess.com",
  audience: "readlet-test",
};

test("a valid Access token returns its verified subject and normalized email", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key: JWTVerifyGetKey = async () => publicKey;
  const token = await new SignJWT({ email: "Alice@Example.com" })
    .setSubject("cloudflare-user-1")
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(config.teamDomain)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  assert.deepEqual(await accessIdentityForToken(token, config, key), {
    subject: "cloudflare-user-1",
    email: "alice@example.com",
  });
});

test("missing, invalid, mis-scoped, and incomplete tokens are refused", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key: JWTVerifyGetKey = async () => publicKey;
  const sign = (claims: Record<string, unknown>, audience = config.audience) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(config.teamDomain)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

  await assert.rejects(
    accessIdentityForToken(null, config, key),
    AccessIdentityError,
  );
  await assert.rejects(
    accessIdentityForToken(
      await sign({ email: "alice@example.com", sub: "alice" }, "wrong"),
      config,
      key,
    ),
    AccessIdentityError,
  );
  await assert.rejects(
    accessIdentityForToken(
      await sign({ email: "alice@example.com" }),
      config,
      key,
    ),
    AccessIdentityError,
  );
  await assert.rejects(
    accessIdentityForToken(await sign({ sub: "alice" }), config, key),
    AccessIdentityError,
  );
});
