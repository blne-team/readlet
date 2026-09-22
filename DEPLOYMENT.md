# Deploy Readlet to Cloudflare

This guide takes a new Readlet fork through its first Cloudflare deployment and
the guided setup at `/setup`. Readlet runs as a Cloudflare Worker and stores the
library, users, and reading state in a private R2 bucket.

The initial deployment deliberately has no `BOOKS` binding. After Cloudflare
Access is protecting the Worker, the bootstrap manager signs in and uses the
setup page to create or select a private bucket and attach it to the Worker.
Later pushes to the fork's `main` branch redeploy the application without
removing that binding.

You need:

- a GitHub account and a fork of this repository;
- a Cloudflare account with Workers and R2 enabled; and
- a Cloudflare Zero Trust organization with an identity provider.

## 1. Fork Readlet

Fork the Readlet repository to your GitHub account. No account-specific R2
configuration needs to be committed.

The checked-in Worker name is `readlet`. If that name is already used in your
Cloudflare account, change `name` in `apps/readlet/wrangler.jsonc` before the
first deployment. Keep `READLET_INSTALLATION`, the Durable Object and rate-limit
bindings, and the `unsafe.metadata.keep_bindings` section unchanged; the setup
flow and later deployments rely on them.

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

## 5. Create a one-time setup token

The setup page calls Cloudflare's REST API to inspect the Worker, create the R2
bucket when needed, and attach the `BOOKS` binding. Create a temporary custom
Cloudflare API token with these account permissions:

- **Account → Workers Scripts → Edit** (`Workers Scripts Write`)
- **Account → Workers R2 Storage → Edit** (`Workers R2 Storage Write`)

Limit its account resources to the account containing the Worker and, when the
dashboard offers it, give the token a short expiration time. Use the bearer
token value from **Account API Tokens** or **My Profile → API Tokens**. Do not
create R2 S3 credentials: an Access Key ID and Secret Access Key cannot complete
the setup flow.

Keep the token available only until the next step succeeds. Readlet sends it
from the setup action directly to Cloudflare and never saves it in R2, the
Worker environment, cookies, or the repository.

## 6. Complete the guided setup

Open the protected hostname in a private browser window and sign in as
`READLET_BOOTSTRAP_MANAGER_EMAIL`. Because the Worker does not have a `BOOKS`
binding yet, Readlet redirects that identity to `/setup`.

Enter the values shown on the setup page:

| Field | What to enter |
| --- | --- |
| Cloudflare account ID | The 32-character ID from **Workers & Pages → Account Details**, or use the dashboard's **Copy account ID** search action |
| Worker name | The deployed Worker name shown in **Workers & Pages**; it is `readlet` unless you changed `wrangler.jsonc` |
| R2 bucket name | A new unique name, or an existing private bucket in the selected jurisdiction |
| Data jurisdiction | Automatic placement, European Union, United States, FedRAMP, or FedRAMP High |
| One-time API token | The temporary bearer token created in the previous step |

Choose the bucket jurisdiction carefully. An existing bucket must be selected
with its current jurisdiction, and a bucket's jurisdiction cannot be changed
later.

Select **Create private library**. Readlet then:

1. confirms that the named Worker contains Readlet's installation marker;
2. creates the bucket if it does not already exist; and
3. adds the bucket to that Worker as the `BOOKS` binding while preserving its
   other bindings.

If the bucket is created but a later API request fails, leave the bucket in
place and retry with the same name and jurisdiction. The setup operation is
safe to retry. It will refuse to replace an existing `BOOKS` binding with a
different bucket.

After the success screen appears:

1. revoke the temporary Cloudflare API token;
2. select **Open Readlet** (binding activation can take a few seconds);
3. confirm that the signed-in identity becomes the manager;
4. open **Books** to import the first EPUB or PDF; and
5. confirm in R2 that the bucket has no public development URL or custom
   domain.

Do not make the R2 bucket public. Readlet serves authorized book and cover
requests through the Worker.

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
- **Cloudflare rejects the setup token:** use a custom bearer API token scoped
  to the correct account with both required write permissions. R2 S3
  credentials are not interchangeable with an API token.
- **Readlet says the Worker is not this deployment:** use the exact Worker name
  from **Workers & Pages**. The selected Worker must contain the
  `READLET_INSTALLATION` variable from this repository.
- **The library is not ready immediately after success:** wait a few seconds for
  the new binding to activate, then reload the root page.

For Cloudflare-specific details, see the documentation for
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/),
[finding an account ID](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/),
[API tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/),
and [R2 buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/).
