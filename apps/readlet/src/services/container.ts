import { readOnlyStorage, type Storage } from "@readlet/core";
import type { R2UsageBudget } from "@readlet/provider-r2/worker";
import {
  openWorkersCache,
  WorkersCache,
} from "@/services/adapters/workers-cache";
import { workersRateLimits } from "@/services/adapters/workers-rate-limit";
import { CatalogService } from "@/services/catalog";
import { BookContentService } from "@/services/content";
import { LibraryManagerService } from "@/services/library-manager";
import { NoopCache, type ResponseCache } from "@/services/ports/cache";
import { NoLimits, type RateLimits } from "@/services/ports/limits";
import { ProgressService } from "@/services/progress";
import { ReaderMarksService } from "@/services/reader-marks";
import { UserService } from "@/services/users";

export type Services = {
  storage: Storage;
  cache: ResponseCache;
  /** What the routes ask before they reach for the bucket. */
  limits: RateLimits;
  catalog: CatalogService;
  content: BookContentService;
  library: LibraryManagerService;
  progress: ProgressService;
  readerMarks: ReaderMarksService;
  users: UserService;
  /** Present only when this deployment spends the shared R2 allowance. */
  r2Usage: R2UsageBudget | null;
  /** Keep work alive after the response on a Cloudflare Worker. */
  defer: ((work: Promise<unknown>) => void) | null;
};

/**
 * Wires the services to a set of adapters. This is the whole composition, and
 * it knows nothing about any provider — give it storage backed by S3 or a
 * filesystem and the app works unchanged. Storage that cannot be written to
 * still composes; existing users can read while state mutations refuse.
 *
 * Limits default to none for the same reason: a runtime that cannot count
 * requests per visitor is one that does not need to.
 */
export function createServices(
  storage: Storage,
  cache: ResponseCache,
  limits: RateLimits = new NoLimits(),
  r2Usage: R2UsageBudget | null = null,
  defer: ((work: Promise<unknown>) => void) | null = null,
): Services {
  const catalog = new CatalogService(storage, cache);
  const progress = new ProgressService(storage);
  const readerMarks = new ReaderMarksService(storage);
  const users = new UserService(storage);

  return {
    storage,
    cache,
    limits,
    catalog,
    content: new BookContentService(storage, cache),
    library: new LibraryManagerService(
      storage,
      catalog,
      users,
      progress,
      readerMarks,
    ),
    progress,
    readerMarks,
    users,
    r2Usage,
    defer,
  };
}

let override: Services | null = null;

/**
 * Replaces what {@link getServices} returns. Tests use this to supply fakes;
 * a different runtime would use it to install its own adapters at startup.
 * Passing null restores the default.
 */
export function setServices(services: Services | null): void {
  override = services;
}

/**
 * Whether this deployment refuses to change anything.
 *
 * A property of the instance rather than of the library, so it comes from the
 * environment and not from readlet.config.json: the same build serves a
 * public demo that must not be edited and a private shelf that must be. The
 * only thing it does is take the write path off storage, which every service
 * already knows how to cope with: users and marks stop offering mutations,
 * and position changes remain live only for the current reading session.
 */
function refusesEdits(): boolean {
  const value = (process.env.READLET_READ_ONLY ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

function compose(
  storage: Storage,
  cache: ResponseCache,
  limits?: RateLimits,
  r2Usage?: R2UsageBudget,
  defer?: (work: Promise<unknown>) => void,
): Services {
  return createServices(
    refusesEdits() ? readOnlyStorage(storage) : storage,
    cache,
    limits,
    r2Usage ?? null,
    defer ?? null,
  );
}

/**
 * The library on a filesystem, for running the app on a machine that has one —
 * your own, or a VPS. There is no Workers cache here, and none is needed: the
 * catalog memo still spares the repeated reads, and the files are local.
 */
async function filesystemServices(): Promise<Services> {
  const directory =
    process.env.READLET_DIRECTORY ?? process.env.READLET_DIRECTORY_DEFAULT;

  if (!directory) {
    throw new Error(
      "The filesystem provider needs a directory. Set `storage.directory` in " +
        "readlet.config.json and rebuild, or pass READLET_DIRECTORY at " +
        "startup.",
    );
  }

  // Left for the runtime to resolve rather than bundled. This provider reads a
  // directory named at startup, so its `open` and `createReadStream` calls take
  // a path the bundler cannot know — and Turbopack answers that by tracing the
  // whole project into the server output, `public/` and all, warning eight
  // times on the way past. The directory is not a build input and never was;
  // saying so is what the comment does. Nothing here changes for the Worker,
  // which resolves the other provider and never reaches this branch.
  const { createStorage } = await import(
    /* turbopackIgnore: true */ "@readlet/provider-fs/node"
  );
  return compose(createStorage({ directory }), new NoopCache());
}

/** The library in R2, read through the Worker binding. */
async function cloudflareServices(): Promise<Services> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const { createStorage, createUsageBudget } = await import(
    "@readlet/provider-r2/worker"
  );

  // Reaching here without a Worker around it almost always means the app was
  // started somewhere with no bindings — a plain Node server — while still
  // built for Cloudflare. The underlying error says nothing about that.
  const context = await getCloudflareContext({ async: true }).catch(
    (cause: unknown) => {
      throw new Error(
        "No Cloudflare Worker context. If this is running on your own machine " +
          "or a VPS, it wants the filesystem provider: set `storage.provider` " +
          'to "fs" in readlet.config.json and rebuild, or start it with ' +
          "READLET_PROVIDER=fs.",
        { cause },
      );
    },
  );

  const { env, ctx } = context;
  if (!env.BOOKS) {
    throw new Error(
      "The Worker has no BOOKS binding. Add an r2_buckets entry to " +
        "wrangler.jsonc naming the bucket the sync tool publishes to.",
    );
  }
  if (!env.R2_USAGE) {
    throw new Error(
      "The Worker has no R2_USAGE Durable Object binding. Add it to wrangler.jsonc before serving R2.",
    );
  }

  const r2Usage = createUsageBudget(env.R2_USAGE);

  const cache = await openWorkersCache();

  if (!cache && process.env.NODE_ENV === "production") {
    throw new Error(
      "R2 production requires a Cloudflare Worker cache and bindings; " +
        "this process is running through a local development proxy.",
    );
  }

  // The bucket is only reachable through this public Worker, so the pair of
  // bindings named here keeps one visitor from spending the library's whole R2
  // allowance. `getCloudflareContext` supplies local stand-ins for them from
  // wrangler.jsonc even under `next dev`. Counting those makes ordinary reader
  // testing exhaust the production allowance: epub.js requests several archive
  // entries per book, after which every chapter receives a 429 for a minute.
  // Development is not exposed to public traffic and does not need that guard.
  const limits =
    process.env.NODE_ENV === "development" ? null : workersRateLimits(env);
  if (!limits && process.env.NODE_ENV === "production") {
    throw new Error(
      "R2 production requires R2_RATE_LIMITER and DOWNLOAD_RATE_LIMITER bindings.",
    );
  }

  return compose(
    createStorage(env.BOOKS, r2Usage),
    // Absent under `next dev`, which runs in Node rather than workerd.
    cache
      ? new WorkersCache(cache, (work) => ctx.waitUntil(work))
      : new NoopCache(),
    limits ?? undefined,
    r2Usage,
    (work) => ctx.waitUntil(work),
  );
}

/**
 * The composition root: the one place that names a provider.
 *
 * The default is baked in at build time from readlet.config.json — see
 * next.config.ts — so the app and the sync tool read the same answer out of the
 * same file. An environment variable still wins, for a deployment that differs
 * from the machine it was built on.
 *
 * Each arm imports its provider dynamically because the two are not
 * interchangeable at run time: one needs a Worker binding, the other a
 * filesystem, and whichever the deployment lacks must never be loaded.
 */
export async function getServices(): Promise<Services> {
  if (override) return override;

  const provider =
    process.env.READLET_PROVIDER ??
    process.env.READLET_PROVIDER_DEFAULT ??
    "r2";

  return provider === "fs" ? filesystemServices() : cloudflareServices();
}
