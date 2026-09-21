# Deploy a Readlet fork to Cloudflare

This guide takes you from a new Readlet fork to a working Cloudflare deployment.
Readlet runs as a Cloudflare Worker, stores its library in a private R2 bucket,
and redeploys automatically when you push changes to your fork's `main` branch.

Readlet also requires Cloudflare Access. Access authenticates each request
before it reaches the Worker, and Readlet uses that verified identity to decide
who can open and manage the library.

You need a GitHub account, a Cloudflare account, and a Cloudflare Zero Trust
team.

## 1. Fork and configure Readlet

Fork the Readlet repository to your GitHub account. Make the following changes
in your fork, either through GitHub's web editor or in a local checkout.

Update `apps/readlet/wrangler.jsonc`:

- Set `name` to the Worker name you want to use.
- Set `services[0].service` to the same Worker name.
- Set `r2_buckets[0].bucket_name` to your R2 bucket name.
- Add `r2_buckets[0].jurisdiction` only when the bucket uses a jurisdiction
  such as `eu`; otherwise omit the property entirely. An empty string is not a
  valid jurisdiction and causes Cloudflare API error `10021` during deploy.
- Keep the `BOOKS` binding, Durable Object, rate-limit bindings, assets, and
  `nodejs_compat` setting unchanged.

For the first deployment, set `workers_dev` to `false` and leave custom routes
unset. This lets you configure Cloudflare Access before making Readlet
reachable at a public hostname. Commit these changes to `main`.

## 2. Create the R2 bucket

In the Cloudflare dashboard, open **R2 Object Storage → Create bucket** and use
the bucket name and jurisdiction configured in `wrangler.jsonc`.

Keep the bucket private: do not enable its public development URL or attach an
R2 custom domain. Readlet serves books through the Worker's `BOOKS` binding.

## 3. Connect Cloudflare to GitHub

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

## 4. Protect the Worker with Cloudflare Access

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

## 5. Add the public hostname

Once Access and the runtime variables are configured, expose the Worker using
one of these options:

- Add a custom domain under **Settings → Domains & Routes**; or
- enable the Worker's `workers.dev` URL, set `workers_dev` to `true` in
  `apps/readlet/wrangler.jsonc`, and push the change to `main`.

Open the hostname in a private browser window and sign in with
`READLET_BOOTSTRAP_MANAGER_EMAIL`. The first successful sign-in creates the
Readlet manager account. Confirm that an uninvited identity cannot open the
library and that the R2 bucket still has no public URL.

Every later push to `main` triggers a new Cloudflare build. Deploying the
application does not publish the local `books/` directory; see
[Publishing a library](docs/publishing.md) when you are ready to add books.

For more detail, see Cloudflare's documentation for
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[R2 buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/), and
[Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).
