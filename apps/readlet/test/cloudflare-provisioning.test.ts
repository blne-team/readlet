import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type ProvisioningClient,
  ProvisioningError,
  provisionCloudflare,
  validateProvisioningInput,
} from "../src/services/cloudflare-provisioning.ts";

const INPUT = {
  accountId: "023e105f4ecef8ad9ca31a8372d0c353",
  workerName: "readlet",
  bucketName: "private-books",
  jurisdiction: "eu" as const,
  apiToken: "temporary-cloudflare-token",
};

function fakeClient(options?: {
  bucket?: { name: string; jurisdiction: string } | null;
  bindings?: Array<{
    name: string;
    type: string;
    bucket_name?: string;
    jurisdiction?: string;
  }>;
}) {
  const calls: string[] = [];
  let replacement: Array<Record<string, unknown>> = [];
  const client: ProvisioningClient = {
    async workerBindings() {
      calls.push("worker");
      return (
        options?.bindings ?? [
          { name: "READLET_INSTALLATION", type: "plain_text" },
          { name: "R2_USAGE", type: "durable_object_namespace" },
          { name: "SECRET", type: "secret_text" },
        ]
      );
    },
    async bucket() {
      calls.push("bucket");
      return options?.bucket === undefined ? null : options.bucket;
    },
    async createBucket() {
      calls.push("create");
      return { name: INPUT.bucketName, jurisdiction: INPUT.jurisdiction };
    },
    async replaceWorkerBindings(_accountId, _workerName, bindings) {
      calls.push("bind");
      replacement = bindings;
    },
  };
  return { calls, client, replacement: () => replacement };
}

test("validates every untrusted setup field", () => {
  const invalid = validateProvisioningInput({
    accountId: "wrong",
    workerName: "not a worker!",
    bucketName: "Uppercase",
    jurisdiction: "moon",
    apiToken: "short",
  });
  assert.deepEqual(Object.keys(invalid.errors ?? {}).sort(), [
    "accountId",
    "apiToken",
    "bucketName",
    "jurisdiction",
    "workerName",
  ]);

  assert.deepEqual(validateProvisioningInput(INPUT as Record<string, string>), {
    input: INPUT,
  });
});

test("creates the bucket and inherits every existing binding", async () => {
  const fake = fakeClient();
  await provisionCloudflare(INPUT, fake.client);

  assert.deepEqual(fake.calls, ["worker", "bucket", "create", "bind"]);
  assert.deepEqual(fake.replacement(), [
    {
      name: "READLET_INSTALLATION",
      type: "inherit",
      version_id: "latest",
    },
    { name: "R2_USAGE", type: "inherit", version_id: "latest" },
    { name: "SECRET", type: "inherit", version_id: "latest" },
    {
      name: "BOOKS",
      type: "r2_bucket",
      bucket_name: "private-books",
      jurisdiction: "eu",
    },
  ]);
});

test("reuses an existing bucket but refuses an unrelated Worker", async () => {
  const existing = fakeClient({
    bucket: { name: INPUT.bucketName, jurisdiction: INPUT.jurisdiction },
  });
  await provisionCloudflare(INPUT, existing.client);
  assert.deepEqual(existing.calls, ["worker", "bucket", "bind"]);

  const unrelated = fakeClient({
    bindings: [{ name: "SOMETHING_ELSE", type: "plain_text" }],
  });
  await assert.rejects(
    () => provisionCloudflare(INPUT, unrelated.client),
    (error: unknown) =>
      error instanceof ProvisioningError &&
      /not this Readlet deployment/.test(error.message),
  );
  assert.deepEqual(unrelated.calls, ["worker"]);
});

test("a matching BOOKS binding makes setup idempotent", async () => {
  const fake = fakeClient({
    bindings: [
      { name: "READLET_INSTALLATION", type: "plain_text" },
      {
        name: "BOOKS",
        type: "r2_bucket",
        bucket_name: INPUT.bucketName,
        jurisdiction: INPUT.jurisdiction,
      },
    ],
  });

  await provisionCloudflare(INPUT, fake.client);
  assert.deepEqual(fake.calls, ["worker"]);
});
