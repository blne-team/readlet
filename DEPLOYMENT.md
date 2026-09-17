# Deploy Readlet with Cloudflare Workers Builds

This guide connects the GitHub repository to a Cloudflare Worker through the
Cloudflare dashboard. Cloudflare builds and deploys the app when you push to the
production branch. Cloudflare natively runs Wrangler and authenticates it with
the token selected in the Worker's **Build Configuration → API token** field.
You do **not** need to create a `CLOUDFLARE_API_TOKEN` variable or copy your
local token into Cloudflare. If Wrangler says no token was provided, the native
build authentication did not reach that command; see [the authentication
troubleshooting step](#wrangler-says-it-needs-cloudflare_api_token). The build
token deploys the **app**; publishing your private books to R2 is a separate
step.

Readlet runs as a **Worker**, not a Cloudflare Pages project. The Worker reads
one private R2 bucket through its `BOOKS` binding. Cloudflare Access checks
requests before the Worker runs, and Readlet verifies the signed Access identity
and its own user directory before serving the library.

## 1. Review the repository configuration

You can deploy the framework without cloning the repository. Review these files
in GitHub and, if their checked-in names do not match your Cloudflare resources,
edit them in GitHub's web interface and commit the changes to the branch you
will connect to Cloudflare. A local checkout is another option. Workers Builds
sees committed files on that branch, not local or uncommitted edits. Cloudflare's
build image installs the workspace dependencies and runs the deploy command;
Node and pnpm versions are covered in step 3.

| File | Set these values |
| --- | --- |
| `apps/readlet/wrangler.jsonc` | `name` is the Worker name; `r2_buckets[0].bucket_name` is your R2 bucket; keep its binding name `BOOKS`. Set `jurisdiction` only if the bucket has that jurisdiction. The `services[0].service` value must match the Worker name. |
| `readlet.config.json` | `storage.provider` stays `r2`; `storage.bucket` must name the same bucket. Set `storage.jurisdiction` to the same jurisdiction, or remove it from both files for a bucket without a jurisdiction restriction. Keep `storage.worker` as `apps/readlet`. |

The checked-in example uses Worker `readlet`, bucket `books`, and the `eu`
jurisdiction. If you use those names, make sure they belong to **your**
Cloudflare account. The sync tool checks that its bucket and the Worker's bucket
agree before uploading.

For the first deployment, set `workers_dev` to `false` in `wrangler.jsonc`, keep
`preview_urls` set to `false`, and leave routes and custom domains unset. Commit
this before connecting GitHub. It lets you deploy and configure Access before
giving the Worker a public hostname. Once Access is active, you can enable a
protected `workers.dev` URL or add a custom domain. Keep the checked-in
`nodejs_compat` flag, OpenNext `main` and `assets` paths, `BOOKS` R2 binding,
and both rate-limit bindings. The app requires those bindings in production.

## 2. Create the private R2 bucket

In the Cloudflare dashboard, open **R2 Object Storage → Create bucket**. Enter
the exact bucket name from the two configuration files. The checked-in `eu`
setting means you must choose **Location → Specify jurisdiction → European
Union**. If you instead choose an ordinary bucket, remove `jurisdiction` from
both files before deploying or publishing. A location hint, such as Western
Europe, is **not** the EU jurisdiction. Cloudflare cannot change a bucket's
jurisdiction after creation. [Cloudflare's data-location
guide](https://developers.cloudflare.com/r2/reference/data-location/) explains
the choices.

In the bucket's **Settings**, leave the **Public Development URL** disabled and
do not attach an R2 custom domain. The Worker-level Access policy protects the
Worker, not a separate URL that serves R2 objects directly. [R2 buckets are
private by default](https://developers.cloudflare.com/r2/buckets/create-buckets/).

You need only this one R2 bucket for the library. Reading positions and users
are stored under `.readlet/` in the same bucket; Readlet does not require D1 or
KV.

## 3. Connect GitHub to the Worker

In **Workers & Pages**, choose **Create application → Import a repository**,
authorize the Cloudflare GitHub app for the repository, and select the repo. If
you already created the matching Worker, open it and choose **Settings → Builds
→ Connect** instead. The Worker name shown in Cloudflare must match
`wrangler.jsonc`'s `name`. See [Workers Builds Git
integration](https://developers.cloudflare.com/workers/ci-cd/builds/).

Set these build options:

| Option | Value for this repository |
| --- | --- |
| Production branch | The branch you deploy from, usually `main` |
| Root directory | `apps/readlet` (this is where `wrangler.jsonc` lives) |
| Build command | `pnpm -C ../.. run bundle` |
| Deploy command | `pnpm run deploy:built` |
| Builds for non-production branches | Disable initially; this setup does not publish preview URLs |
| API token | Use the Cloudflare-managed default. Workers Builds creates this automatically; do not add `CLOUDFLARE_API_TOKEN` or paste `.wrangler-auth`. |

Workers Builds checks out source code from GitHub and installs workspace
dependencies. It runs both commands from `apps/readlet`. The build command
changes to the repository root, where Turborepo compiles shared packages,
copies PDF assets, and runs `opennextjs-cloudflare build`. OpenNext runs the
Next.js build and converts its output into `.open-next/worker.js` and
`.open-next/assets`. The deploy command does not rebuild: it checks that CLI
credentials did not enter the bundle and asks OpenNext to upload the compiled
Worker through Wrangler. This split keeps compilation in Cloudflare's build
phase and the authenticated Wrangler call in its deploy phase.
Cloudflare's [monorepo](https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/)
and [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
guides cover these dashboard settings.

Readlet produces a server-rendered Next.js Worker with R2, service,
rate-limit, and asset bindings, so its OpenNext deploy script invokes Wrangler
explicitly. Both deployments still need Cloudflare to authorize the upload;
Workers Builds manages that authorization automatically in either case.

The project requires Node 24 or newer and declares `pnpm@10.34.5` in the root
`package.json`. If the build image uses different versions, add **build**
variables `NODE_VERSION=24` and `PNPM_VERSION=10.34.5` under **Settings → Build
→ Build Variables and Secrets**. These select tooling; they are not Worker
runtime variables. Check [Cloudflare's build
image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
for its current defaults.

Save and deploy, then check **Deployments → View build history** for a successful
build. Later pushes to the production branch will trigger another deployment.
Workers Builds changes the app code; it does not run `pnpm sync` or copy the
ignored `books/` folder into R2.

### Wrangler says it needs `CLOUDFLARE_API_TOKEN`

If the build log says `In a non-interactive environment, it's necessary to set a
CLOUDFLARE_API_TOKEN environment variable for wrangler to work`, Wrangler was
invoked without credentials. This is Wrangler's generic message for any
unauthenticated CI environment; it does not mean a Workers Builds user should
manually create that environment variable. The browser dashboard uses your
interactive login, while the isolated build machine uses the selected Workers
Builds token. This is an authentication failure, separate from the
workspace-root detection error. Open **Workers & Pages → your Worker →
Settings → Build → Build Configuration** and check the **API token** selected
for the production build. Select **Create new token** if the selection is empty
or its token has been deleted or rotated, save, and retry the build. Cloudflare
uses that build token for the deploy command, including Readlet's OpenNext
command, which launches Wrangler. [Cloudflare's build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
and [build troubleshooting](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/)
describe the build-token setting.

Do not put your local `.wrangler-auth` token in **Worker runtime Variables and
Secrets**; those values configure the running app and do not authenticate the
build. Do not put `CLOUDFLARE_API_TOKEN` in Workers Builds' **Build Variables
and Secrets** either: OpenNext may include build variables in its Worker bundle.
Readlet's deploy script checks for bundled CLI credentials before upload. If
the build-token selection is valid but the same Wrangler error persists, check
the full build log to see whether Wrangler ran during the build or deploy step
and confirm the token belongs to the same Cloudflare account as the Worker.

## 4. Put the Worker behind Cloudflare Access

Enable Zero Trust for your Cloudflare account and configure the identity
provider your readers will use (for example, One-time PIN). In **Workers & Pages
→ your Worker → Access**, choose **Protect this Worker behind Access → All
traffic** and an **Allow** policy for the intended sign-in identities. Avoid a
Bypass policy: it will not supply the signed identity Readlet requires. A
Worker-level policy covers its production and preview URLs, routes, and custom
domains. Check **Zero Trust → Access controls → Applications** for a more
specific hostname or path application that might take precedence. See
[Cloudflare's Worker-level Access
guide](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

In **Workers & Pages → your Worker → Settings → Variables and Secrets**, add
these **runtime** variables, then deploy the settings:

| Name | Value |
| --- | --- |
| `READLET_ACCESS_TEAM_DOMAIN` | `https://<your-team>.cloudflareaccess.com` |
| `READLET_ACCESS_AUD` | The protected Access application's **Audience (AUD) Tag** |
| `READLET_BOOTSTRAP_MANAGER_EMAIL` | The verified email of the first Readlet manager |
| `READLET_SITE_URL` (optional) | The final public URL, for canonical URLs and link previews |
| `READLET_READ_ONLY` (optional) | `1` to stop user and reading-state writes |

Find the team domain in Zero Trust and the AUD tag on the Access application in
**Zero Trust → Access controls → Applications**. The first successful login by
`READLET_BOOTSTRAP_MANAGER_EMAIL` creates the manager. Managers can invite
other verified emails at `/users`. The `keep_vars: true` setting in
`wrangler.jsonc` preserves dashboard-set runtime variables across subsequent
deploys. See [Configure identity and the first
manager](docs/providers/r2.md#configure-identity-and-the-first-manager).

The deployment API token is not an identity source and Readlet never uses it to
look up an email address. At request time, Cloudflare Access places the signed
user identity in its authorization token; Readlet verifies that token's issuer,
audience, signature, and email claim. The two `READLET_ACCESS_*` values and
`READLET_BOOTSTRAP_MANAGER_EMAIL` tell Readlet which Access application to trust
and which verified email may create the first manager.

These values belong in **Worker runtime settings**, not in Workers Builds'
**Build Variables and Secrets**. Build variables are available only during the
build and may be included in the Next/OpenNext bundle. Do not add your local
`CLOUDFLARE_API_TOKEN` to either place or to a repository `.env` file. The
repository's `.env` and `apps/readlet/.env.local` are local files; Git ignores
them, and a Cloudflare Git build cannot read them.

After Access is active and the runtime values are set, add a public hostname
under **Settings → Domains & Routes → Add → Custom Domain**, or enable the
Worker's `workers.dev` URL. If you enable `workers.dev`, also set `workers_dev`
to `true` in `wrangler.jsonc` and push that change so the next Git deployment
keeps it enabled. [Cloudflare's custom-domain
guide](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
describes the dashboard flow.

## 5. Publish your books separately

This step is separate from deploying the framework. It requires a local
checkout if you use Readlet's `pnpm sync` tool to prepare and publish your own
library. Put your EPUBs and PDFs in the local `books/` folder. It is
Git-ignored: a GitHub push deploys the framework, not your library. On your own
machine, run from the repository root:

```bash
pnpm install
pnpm --filter @readlet/app exec wrangler login
pnpm sync --dry-run
pnpm sync
```

`wrangler login` uses browser authentication, so this route does not need a
manually supplied API token. If you prefer your existing ignored
`.wrangler-auth` file, load it **only** for the local sync command:

```bash
node --env-file=.wrangler-auth "$(command -v pnpm)" sync
```

Because the bucket was created in the dashboard, use `pnpm sync`, not
`pnpm sync --create`; `--create` is for creating the bucket through Wrangler.
The sync tool builds `library/`, uploads the catalog, books and covers, and
maintains Readlet's published book list. It does not remove `.readlet/` user or
reading state. See [Publishing a library](docs/publishing.md) for later updates
and `--force` behavior.

## 6. Check the deployment

Open the protected hostname in a private browser window as the bootstrap
manager. Cloudflare should prompt for sign-in, then Readlet should show the
published shelf. A different verified email that has not been invited should
reach Readlet's access-denied page. Check every hostname attached to the Worker
and confirm the R2 bucket still has no direct public URL. If the shelf is empty,
check the R2 bucket named in both configuration files and rerun `pnpm sync`.

Back up the R2 bucket, including `.readlet/`, before replacing a library or
changing deployments. The bucket contains the published books, users, and
reading positions. For Cloudflare-specific troubleshooting, see [the R2
provider](docs/providers/r2.md#troubleshooting).
