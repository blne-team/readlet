# Deploy a Readlet fork to Cloudflare

This guide takes you from a new Readlet fork to a working Cloudflare deployment.
Readlet runs as a Cloudflare Worker, stores its library in a private R2 bucket,
and redeploys automatically when you push changes to your fork's `main` branch.

Readlet also requires Cloudflare Access. Access authenticates each request
before it reaches the Worker, and Readlet uses that verified identity to decide
who can open and manage the library.

You need a GitHub account, a Cloudflare account, and a Cloudflare Zero Trust
team.

## 1. Fork Readlet

Fork the Readlet repository to your GitHub account. The checked-in Worker
configuration is intentionally account-independent: the first deployment has
no `BOOKS` binding, and the authenticated setup page provisions it later.

## 2. Connect Cloudflare to GitHub

In the Cloudflare dashboard, open **Workers & Pages → Create application →
Import a repository**. Authorize Cloudflare to access GitHub, select your
Readlet fork, and configure the build:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `apps/readlet` |
| Build command | `pnpm -C ../.. run bundle` |
| Deploy command | `pnpm run deploy:built` |
| Non-production branch builds | Disabled initially |

The repository requires Node.js 24 and declares `pnpm@10.34.5`. If Cloudflare's
build environment does not select those versions automatically, add these
build variables:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `PNPM_VERSION` | `10.34.5` |

Save the configuration and start the first deployment. After the connection is
created, Cloudflare receives GitHub push events and automatically rebuilds and
deploys `main`.

## 3. Protect the Worker with Cloudflare Access

After the first deployment:

1. In Cloudflare Zero Trust, configure the identity provider your readers will
   use.
2. Open **Workers & Pages → your Worker → Access** and select **Protect this
   Worker behind Access → All traffic**.
3. Create an **Allow** policy for the identities that may reach Readlet. Do not
   use a Bypass policy because Readlet requires the signed Access identity.
4. In **Workers & Pages → your Worker → Settings → Variables and Secrets**, add
   these runtime variables:

| Variable | Value |
| --- | --- |
| `READLET_ACCESS_TEAM_DOMAIN` | `https://<your-team>.cloudflareaccess.com` |
| `READLET_ACCESS_AUD` | The Access application's Audience (AUD) tag |
| `READLET_BOOTSTRAP_MANAGER_EMAIL` | The verified email of the first Readlet manager |
| `READLET_SITE_URL` | Optional final public URL used for canonical URLs and link previews |

These are Worker runtime settings. The `keep_vars: true` setting in
`wrangler.jsonc` preserves them during later deployments.

## 4. Add the public hostname

Once Access and the runtime variables are configured, expose the Worker using
one of these options:

- Add a custom domain under **Settings → Domains & Routes**; or
- enable the Worker's `workers.dev` URL, set `workers_dev` to `true` in
  `apps/readlet/wrangler.jsonc`, and push the change to `main`.

## 5. Create the private library

Create a temporary Cloudflare API token scoped to this account with these
permissions:

- **Workers Scripts: Edit**
- **Workers R2 Storage: Edit**

Open the hostname in a private browser window and sign in with
`READLET_BOOTSTRAP_MANAGER_EMAIL`. Readlet redirects the first verified manager
to `/setup`. Enter the account ID, the Worker name shown under **Workers &
Pages**, the desired bucket name and jurisdiction, and the temporary token.

Readlet verifies that the named Worker is this deployment, creates the private
bucket, and attaches it as `BOOKS`. It never stores the token. Revoke the token
after setup succeeds, open Readlet, and confirm that the manager account is
created and the bucket still has no public URL or custom domain.

Every later push to `main` triggers a new Cloudflare build. Deploying the
application does not publish the local `books/` directory; see
[Publishing a library](docs/publishing.md) when you are ready to add books.

For more detail, see Cloudflare's documentation for
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[R2 buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/), and
[Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).
