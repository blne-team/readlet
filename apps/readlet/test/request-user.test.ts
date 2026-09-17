import assert from "node:assert/strict";
import { test } from "node:test";
import {
  identityForHeaders,
  routeUser,
  userForHeaders,
} from "../src/services/request-user.ts";

test("the local bypass is ignored outside development", async () => {
  const previous = {
    domain: process.env.READLET_ACCESS_TEAM_DOMAIN,
    audience: process.env.READLET_ACCESS_AUD,
    manager: process.env.READLET_BOOTSTRAP_MANAGER_EMAIL,
    bypass: process.env.READLET_DEV_AUTH_BYPASS,
    nodeEnv: process.env.NODE_ENV,
  };

  try {
    delete process.env.READLET_ACCESS_TEAM_DOMAIN;
    delete process.env.READLET_ACCESS_AUD;
    delete process.env.READLET_BOOTSTRAP_MANAGER_EMAIL;
    process.env.READLET_DEV_AUTH_BYPASS = "1";
    setEnvironment("NODE_ENV", "production");

    const response = await routeUser(new Request("https://shelf.test/"));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    restore("READLET_ACCESS_TEAM_DOMAIN", previous.domain);
    restore("READLET_ACCESS_AUD", previous.audience);
    restore("READLET_BOOTSTRAP_MANAGER_EMAIL", previous.manager);
    restore("READLET_DEV_AUTH_BYPASS", previous.bypass);
    restore("NODE_ENV", previous.nodeEnv);
  }
});

test("the explicit development bypass supplies one synthetic local user", async () => {
  const previous = {
    bypass: process.env.READLET_DEV_AUTH_BYPASS,
    nodeEnv: process.env.NODE_ENV,
  };

  try {
    process.env.READLET_DEV_AUTH_BYPASS = "1";
    setEnvironment("NODE_ENV", "development");
    const headers = new Headers();

    assert.deepEqual(await identityForHeaders(headers), {
      subject: "readlet-local-development",
      email: "developer@readlet.local",
    });
    assert.deepEqual(await userForHeaders(headers), {
      id: "u-00000000-0000-4000-8000-000000000000",
      accessSubject: "readlet-local-development",
      email: "developer@readlet.local",
      displayName: "Local developer",
      role: "member",
      status: "active",
      createdAt: new Date(0).toISOString(),
      createdBy: "u-00000000-0000-4000-8000-000000000000",
    });
  } finally {
    restore("READLET_DEV_AUTH_BYPASS", previous.bypass);
    restore("NODE_ENV", previous.nodeEnv);
  }
});

function setEnvironment(name: string, value: string): void {
  process.env[name] = value;
}

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
