# Deploy Readlet to Cloudflare

This guide takes a new Readlet fork through its first Cloudflare deployment and
the guided setup at `/setup`. Readlet runs as a Cloudflare Worker and stores the
library, users, and reading state in a private R2 bucket.

The initial deployment deliberately has no `BOOKS` binding. After Cloudflare
Access is protecting the Worker, the bootstrap manager follows the setup page
to create a private bucket in the Cloudflare dashboard and attach it to the
Worker. Later pushes to the fork's `main` branch redeploy the application
without removing that binding.

You need:

- a GitHub account and a fork of this repository;
- a Cloudflare account with Workers and R2 enabled; and
- a Cloudflare Zero Trust organization with an identity provider.

## 1. Fork Readlet

Fork the Readlet repository to your GitHub account. No account-specific R2
configuration needs to be committed.

The checked-in Worker name is `readlet`. If that name is already used in your
Cloudflare account, change `name` in `apps/readlet/wrangler.jsonc` before the
first deployment. Keep the Durable Object and rate-limit bindings, and the
`unsafe.metadata.keep_bindings` section unchanged; the setup flow and later
deployments rely on them.

## 2. Connect the fork to Cloudflare

In the Cloudflare dashboard, open **Workers & Pages → Create application →
Import a repository**. Authorize Cloudflare to access GitHub, select the fork,
and configure the build:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `apps/readlet` |
| Build command | `pnpm -C ../.. run bundle` |
| Deploy command | `pnpm run deploy:built` |
| Non-production branch builds | Disabled initially |

The repository requires Node.js 24 or newer and declares `pnpm@10.34.5`. If the
build environment does not select those versions automatically, add these
build variables:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `PNPM_VERSION` | `10.34.5` |

Save the configuration and start the first deployment. It is expected to
succeed without an R2 bucket or `BOOKS` binding.

The checked-in configuration enables the production `workers.dev` URL and
disables preview URLs. Do not share or use the production URL until the next
step protects the Worker with Access.

## 3. Protect the Worker with Cloudflare Access

Readlet requires a signed Cloudflare Access identity on every private request.
An Access policy alone is not enough: the three runtime variables below tell
Readlet how to verify the signed identity and which person may perform the
one-time setup.

1. In **Workers & Pages**, select the new Worker and open **Access**.
2. Select **Protect this Worker behind Access**, choose **All traffic**, and
   create or select an **Allow** policy that includes the future bootstrap
   manager. Do not use a Bypass policy, because bypassed requests have no
   signed Access identity for Readlet to verify.
3. Open **Settings → Variables and Secrets** for the Worker and add:

| Variable | Required value |
| --- | --- |
| `READLET_ACCESS_TEAM_DOMAIN` | The full Zero Trust team URL, such as `https://your-team.cloudflareaccess.com` |
| `READLET_ACCESS_AUD` | The Access application's Audience (AUD) tag |
| `READLET_BOOTSTRAP_MANAGER_EMAIL` | The exact email the identity provider verifies for the first Readlet manager |
| `READLET_SITE_URL` | Optional canonical public origin, such as `https://books.example.com` |

The team domain is available under **Zero Trust → Settings**. The Audience tag
belongs to the Access application created for the Worker. Email matching is
case-insensitive, but the address must otherwise be the identity provider's
verified email.

These are Worker runtime variables, not Workers Builds variables. The
`keep_vars: true` setting in `wrangler.jsonc` preserves dashboard-managed
variables during later deployments.

Only the bootstrap manager can open `/setup`. Other identities allowed by the
Cloudflare policy will see Readlet's access-denied page until the manager adds
them under **Users** after installation.

## 4. Choose the public hostname

The first deployment is already available at
`https://<worker-name>.<account-subdomain>.workers.dev`. Worker-level Access
with **All traffic** protects that hostname.

For a custom hostname, open **Settings → Domains & Routes** for the Worker and
add a custom domain. Then set `READLET_SITE_URL` to its `https://` origin.
Because Access is attached to the Worker, the same policy protects its custom
domain as well.

Keep `workers_dev: true` if you want the `workers.dev` address to remain
available. To use only the custom domain, set `workers_dev` to `false` in
`apps/readlet/wrangler.jsonc` and push the change. Changing it only in the
dashboard is temporary: the next Wrangler deployment will reapply the checked-in
setting.

## 5. Create and bind the private bucket

Open the protected hostname in a private browser window and sign in as
`READLET_BOOTSTRAP_MANAGER_EMAIL`. Because the Worker does not have a `BOOKS`
binding yet, Readlet redirects that identity to `/setup`.

Keep that page open, then use another tab to configure Cloudflare:

1. Open **R2 Object Storage → Overview** and select **Create bucket**.
2. Choose its name, location, and **Standard** storage class. A bucket's
   jurisdiction cannot be changed later.
3. Leave the bucket's public development URL disabled and do not attach a
   custom domain.
4. Open **Workers & Pages → your Readlet Worker → Settings → Bindings**.
5. Add an **R2 bucket** binding, enter `BOOKS` as the variable name, select the
   bucket, and save the change.

The binding is both Readlet's connection to the bucket and its authority to
use it. Do not create an R2 access key, S3 connection string, or temporary
Cloudflare API token for Readlet.

## 6. Verify and initialize Readlet

Return to `/setup` and select **Check connection**. Readlet then:

1. checks whether the Worker runtime can see `BOOKS`;
2. reads and writes the private bucket through that binding; and
3. creates the first manager account when the bucket is empty.

Cloudflare can take a few seconds to activate a new binding. If it is not
visible yet, leave the binding in place and try again.

After Readlet opens:

1. confirm that the signed-in identity became the manager;
2. open **Books** to import the first EPUB or PDF; and
3. confirm in R2 that the bucket has no public development URL or custom
   domain.

Do not make the R2 bucket public. Readlet serves authorized book and cover
requests through the Worker.

### Reset an initialized library

The `/setup` page is only available while the Worker has no `BOOKS` binding.
After initialization, the configured bootstrap manager can instead open
**Books**, scroll to **Reset Cloudflare library**, type `RESET`, and reset the
installation. This permanently deletes every object in the bound bucket and
then recreates the signed-in bootstrap manager. The R2 binding and Readlet's
usage-safety accounting stay in place; other users, books, reading state,
bookmarks, and app passwords do not.

## Later deployments

Every later push to `main` triggers a new Cloudflare build. The checked-in
`keep_bindings` metadata preserves the dashboard-created `BOOKS` binding, and
`keep_vars` preserves the runtime variables. Avoid removing either setting or
adding account-specific bucket details to the repository.

Deploying the application does not publish the local `books/` directory. See
[Publishing a library](docs/publishing.md) for the sync workflow, or import
books from the manager page.

## Troubleshooting first-run setup

- **The Access login never appears:** confirm that the Worker is protected with
  **All traffic**, not only preview deployments.
- **Readlet says the Access variables are missing:** add all three required
  runtime variables under the Worker's **Settings → Variables and Secrets**,
  then retry the request.
- **The bootstrap identity reaches Access denied:** compare the email verified
  by the identity provider with `READLET_BOOTSTRAP_MANAGER_EMAIL`, and confirm
  that the Access policy allows it.
- **Readlet cannot see the bucket:** confirm that the R2 binding is on the
  production Readlet Worker, its variable name is exactly `BOOKS`, and the
  dashboard change was saved. Wait a few seconds and select **Check
  connection** again.
- **Readlet sees the binding but cannot use it:** remove and recreate the
  binding, making sure it points to an existing R2 bucket in the same
  Cloudflare account.

For Cloudflare-specific details, see the documentation for
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/),
[R2 bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/),
and [R2 buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/).
