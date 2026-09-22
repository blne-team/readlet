export const R2_JURISDICTIONS = [
  "default",
  "eu",
  "us",
  "fedramp",
  "fedramp-high",
] as const;

export type R2Jurisdiction = (typeof R2_JURISDICTIONS)[number];

export type ProvisioningInput = {
  accountId: string;
  workerName: string;
  bucketName: string;
  jurisdiction: R2Jurisdiction;
  apiToken: string;
};

type WorkerBinding = {
  name: string;
  type: string;
  bucket_name?: string;
  jurisdiction?: string;
};

type Bucket = { name?: string; jurisdiction?: string };

export type ProvisioningClient = {
  workerBindings(
    accountId: string,
    workerName: string,
  ): Promise<WorkerBinding[]>;
  bucket(
    accountId: string,
    bucketName: string,
    jurisdiction: R2Jurisdiction,
  ): Promise<Bucket | null>;
  createBucket(
    accountId: string,
    bucketName: string,
    jurisdiction: R2Jurisdiction,
  ): Promise<Bucket>;
  replaceWorkerBindings(
    accountId: string,
    workerName: string,
    bindings: WorkerBinding[],
  ): Promise<void>;
};

export class ProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvisioningError";
  }
}

export type ProvisioningValidation = {
  accountId?: string;
  workerName?: string;
  bucketName?: string;
  jurisdiction?: string;
  apiToken?: string;
};

export function validateProvisioningInput(
  value: Record<string, FormDataEntryValue | undefined>,
): { input?: ProvisioningInput; errors?: ProvisioningValidation } {
  const accountId = text(value.accountId);
  const workerName = text(value.workerName);
  const bucketName = text(value.bucketName);
  const jurisdiction = text(value.jurisdiction);
  const apiToken = text(value.apiToken);
  const errors: ProvisioningValidation = {};

  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    errors.accountId = "Enter the 32-character Cloudflare account ID.";
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(workerName)) {
    errors.workerName = "Enter the Worker name shown in Workers & Pages.";
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(bucketName)) {
    errors.bucketName =
      "Use 3–63 lowercase letters, numbers, and hyphens; start and end with a letter or number.";
  }
  if (!(R2_JURISDICTIONS as readonly string[]).includes(jurisdiction)) {
    errors.jurisdiction = "Choose a supported R2 jurisdiction.";
  }
  if (apiToken.length < 20 || apiToken.length > 512 || /\s/.test(apiToken)) {
    errors.apiToken = "Enter a valid Cloudflare API token.";
  }

  if (Object.keys(errors).length) return { errors };
  return {
    input: {
      accountId,
      workerName,
      bucketName,
      jurisdiction: jurisdiction as R2Jurisdiction,
      apiToken,
    },
  };
}

function text(value: FormDataEntryValue | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Creates the private bucket and atomically replaces only the BOOKS binding. */
export async function provisionCloudflare(
  input: ProvisioningInput,
  suppliedClient?: ProvisioningClient,
): Promise<void> {
  const client = suppliedClient ?? (await cloudflareClient(input.apiToken));
  const bindings = await client.workerBindings(
    input.accountId,
    input.workerName,
  );

  if (!bindings.some((binding) => binding.name === "READLET_INSTALLATION")) {
    throw new ProvisioningError(
      "That Worker is not this Readlet deployment. Check the Worker name.",
    );
  }

  const current = bindings.find((binding) => binding.name === "BOOKS");
  if (current) {
    const sameJurisdiction =
      (current.jurisdiction ?? "default") === input.jurisdiction;
    if (current.bucket_name === input.bucketName && sameJurisdiction) return;
    throw new ProvisioningError(
      "This Readlet deployment is already connected to a different R2 bucket.",
    );
  }

  const existing = await client.bucket(
    input.accountId,
    input.bucketName,
    input.jurisdiction,
  );
  if (!existing) {
    await client.createBucket(
      input.accountId,
      input.bucketName,
      input.jurisdiction,
    );
  } else if ((existing.jurisdiction ?? "default") !== input.jurisdiction) {
    throw new ProvisioningError(
      "That bucket exists in a different jurisdiction. Choose its jurisdiction or another name.",
    );
  }

  const inherited = bindings
    .filter((binding) => binding.name !== "BOOKS")
    .map((binding) => ({
      name: binding.name,
      type: "inherit",
      version_id: "latest",
    }));
  const books: WorkerBinding = {
    name: "BOOKS",
    type: "r2_bucket",
    bucket_name: input.bucketName,
    ...(input.jurisdiction === "default"
      ? {}
      : { jurisdiction: input.jurisdiction }),
  };
  await client.replaceWorkerBindings(input.accountId, input.workerName, [
    ...inherited,
    books,
  ]);
}

async function cloudflareClient(apiToken: string): Promise<ProvisioningClient> {
  const { default: Cloudflare } = await import("cloudflare");
  const api = new Cloudflare({ apiToken, maxRetries: 1, timeout: 30_000 });

  async function safe<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const status =
        error && typeof error === "object" && "status" in error
          ? error.status
          : undefined;
      if (status === 401) {
        throw new ProvisioningError("Cloudflare rejected the API token.");
      }
      if (status === 403) {
        throw new ProvisioningError(
          "The API token needs Workers Scripts Write and Workers R2 Storage Write permissions.",
        );
      }
      throw new ProvisioningError(
        error instanceof Error
          ? `Cloudflare could not complete setup: ${error.message}`
          : "Cloudflare could not complete setup.",
      );
    }
  }

  return {
    async workerBindings(accountId, workerName) {
      const settings = await safe(() =>
        api.workers.scripts.scriptAndVersionSettings.get(workerName, {
          account_id: accountId,
        }),
      );
      return (settings.bindings ?? []) as WorkerBinding[];
    },
    async bucket(accountId, bucketName, jurisdiction) {
      try {
        return (await api.r2.buckets.get(bucketName, {
          account_id: accountId,
          jurisdiction: jurisdiction as "default",
        })) as Bucket;
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          error.status === 404
        ) {
          return null;
        }
        return safe(() => Promise.reject(error));
      }
    },
    async createBucket(accountId, bucketName, jurisdiction) {
      return (await safe(() =>
        api.r2.buckets.create({
          account_id: accountId,
          name: bucketName,
          jurisdiction: jurisdiction as "default",
        }),
      )) as Bucket;
    },
    async replaceWorkerBindings(accountId, workerName, bindings) {
      await safe(() =>
        api.workers.scripts.scriptAndVersionSettings.edit(workerName, {
          account_id: accountId,
          settings: { bindings },
        } as never),
      );
    },
  };
}
