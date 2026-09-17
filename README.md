# Readlet

[![CI](https://github.com/blne-team/readlet/actions/workflows/ci.yml/badge.svg)](https://github.com/blne-team/readlet/actions/workflows/ci.yml)

A self-hosted library for the ebooks you already own. Put your EPUBs and PDFs in
a folder, publish them, and read them in any browser — or on your Kobo, through
the [OPDS catalog](docs/opds.md).

![The shelf: a searchable list of books with covers, the current user, and a Continue button on the book being read](docs/shelf.webp)

Run it as a Cloudflare Worker over R2, or as a Node server over a directory on
your own machine. Both use the same code and the same library.

📖 **[Full documentation](https://blne-team.github.io/readlet/)**

## Prepare a demo library

You'll need Node 24 or newer and a Unix-like system. Windows isn't supported —
the sync tool looks for its image tools with `which`.

```bash
git clone https://github.com/blne-team/readlet.git
cd readlet
pnpm install
pnpm demo
```

`pnpm demo` writes nine generated public-domain books into `books/` — eight
EPUBs and a PDF. It downloads nothing. Browsing them requires a Cloudflare
Access-protected deployment; a direct local request has no signed identity and
is denied.

The checked-in `readlet.config.json` points at Cloudflare R2, so `pnpm sync`
goes there unless you change it. For a local look, switch it to the
filesystem provider first:

```jsonc
// readlet.config.json
{ "storage": { "provider": "fs", "directory": "shelf-data" } }
```

## Set up your own

Put your books in `books/`, then pick where the library should live.

### With Docker

The shortest route, and the image ships the tools that make covers.
Copy `apps/readlet/.env.example` to `apps/readlet/.env.local` and fill in the
three Access values before starting Compose. Compose supplies that file to the
app container at run time; the image does not contain it.

```bash
cp apps/readlet/.env.example apps/readlet/.env.local
mkdir books && cp ~/Downloads/*.epub books/
docker compose run --rm sync --create
docker compose up -d
```

The server listens on <http://localhost:3000>, but direct requests are denied.
Put it behind Cloudflare Access and forward the signed
`Cf-Access-Jwt-Assertion` header before browsing. Sync flags pass through, so
`docker compose run --rm sync --force` works as it does locally.

Back up the `library` volume — it holds your published books and your reading
positions. To bind-mount a host directory instead, chown it first:

```bash
chown -R 1000:1000 /srv/readlet
```

### On a machine you own

This changes where the books are stored, not how readers authenticate. The
Node server still needs an Access-protected public endpoint and the three
identity variables below.
For a repository checkout, put them in `apps/readlet/.env.local` using
`apps/readlet/.env.example` as a template. Next loads environment files from
the app directory, so the repository-root `.env` is not read by the app.

```jsonc
// readlet.config.json
{ "storage": { "provider": "fs", "directory": "shelf-data" } }
```

```bash
pnpm sync --create
pnpm build
pnpm --filter @readlet/app start
```

More in [the filesystem provider](docs/providers/fs.md).

### On Cloudflare

You'll need a Cloudflare account. Edit `readlet.config.json` and
`apps/readlet/wrangler.jsonc` so they name your bucket and Worker — if they
disagree, the sync tool stops before uploading.

For automatic deployments from GitHub through the Cloudflare dashboard, follow
[the deployment guide](DEPLOYMENT.md). Workers Builds manages its own deploy
token; the local token below is only for Wrangler CLI commands.

```bash
pnpm --filter @readlet/app exec wrangler login
pnpm run deploy
```

Before opening the Worker URL, [configure Cloudflare Access and the bootstrap
manager](docs/providers/r2.md#protect-the-worker-with-cloudflare-access).
Readlet requires the signed Access identity on every private request. More in
[the R2 provider](docs/providers/r2.md). After Access and the R2 budget's sync
credentials are configured, publish with `pnpm sync --create`.

Keep `CLOUDFLARE_API_TOKEN` in the shell or an ignored `.wrangler-auth` file,
not in a repository `.env` file: OpenNext includes `.env` values in the Worker
bundle. The deploy and upload scripts check for CLI credentials before upload.

## Before you commit a library to it

**Cloudflare Access authentication is required.** Readlet verifies its signed
application token, then checks the identity against its own user directory.
The first configured email becomes the manager; managers invite and disable
readers at `/users`. An authenticated identity that is not active in that
directory cannot read the shelf, books, covers, downloads, OPDS, or state APIs.

**Nothing is encrypted.** Your library is stored in the clear, and object keys
are slugified titles — a listing of your storage names your shelf. With the
filesystem provider you can keep it on
[an encrypted volume](docs/providers/fs.md#encrypting-your-library-at-rest)
today.

**Two devices reading as one user at once is last-write-wins.**

[What's missing](docs/roadmap.md) has the full list.

## Configuration

| variable | what it does |
| --- | --- |
| `READLET_READ_ONLY` | set to `1` and storage keeps serving existing users but stops accepting user or reading-state changes |
| `READLET_PROVIDER` | override the provider the build was made with |
| `READLET_DIRECTORY` | override where the filesystem provider looks |
| `READLET_SITE_URL` | the public address, for link previews and canonical URLs. Set it behind a proxy that doesn't say so |
| `READLET_DEV_AUTH_BYPASS` | set to `1` to use the synthetic local user under `next dev` only; `pnpm dev:no-auth` sets it for you |
| `READLET_ACCESS_TEAM_DOMAIN` | the Cloudflare Access team domain used to verify tokens |
| `READLET_ACCESS_AUD` | the protected application's Audience (AUD) tag |
| `READLET_BOOTSTRAP_MANAGER_EMAIL` | the only verified email allowed to create the first manager |
| `READLET_R2_BILLING_DAY` | UTC day when the Cloudflare billing period begins; used to reset R2 operation counters |

Everything else lives in `readlet.config.json` — see
[publishing](docs/publishing.md#configure-where-things-go).
The three identity values are required at request time. A request without an
Access token receives an access denial; a request with one cannot be verified
until the values are set. `pnpm build` does not supply Worker runtime values.

## Commands

All from the repository root.

```bash
pnpm dev          # local storage testing; direct browser requests are denied
pnpm dev:no-auth  # local development with a synthetic user and no Access login
pnpm sync         # build the library and publish it
pnpm build        # build every workspace
pnpm check-types  # typecheck every workspace
pnpm preview      # build + run the Worker locally
pnpm run deploy   # build + deploy to Cloudflare Workers
pnpm test             # the test suite
pnpm lint         # biome, across the repo
```

The no-auth command works only while Next is in development mode. The local
user is not added to the user directory, has no user-management access, and
cannot enable this bypass in `pnpm preview`, `pnpm start`, or a deployed Worker.

`pnpm --filter @readlet/app cf-typegen` regenerates `cloudflare-env.d.ts` after
you edit `wrangler.jsonc`.

## Documentation

Published at <https://blne-team.github.io/readlet/>.

| | |
| --- | --- |
| [Publishing a library](docs/publishing.md) | the sync tool, its flags, and covers |
| [The library format](docs/library-format.md) | what ends up in storage, and what to back up |
| [Storage providers](docs/providers/README.md) | choosing where your library lives |
| [Cloudflare R2](docs/providers/r2.md) | setup, deploying, publishing locally |
| [Deploy with Cloudflare Workers Builds](DEPLOYMENT.md) | connect GitHub, configure R2 and Access, and deploy through the dashboard |
| [Filesystem](docs/providers/fs.md) | your own machine or a VPS |
| [Users](docs/users.md) | membership, managers, and private reading state |
| [Reading in the browser](docs/reader.md) | the readers and their controls |
| [The OPDS catalog](docs/opds.md) | reading on a Kobo, a Kindle, or any OPDS client |
| [Architecture](docs/architecture.md) | for working on the code |
| [What's missing](docs/roadmap.md) | limitations, and what's planned |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: Node 24, `pnpm install`, and
`pnpm lint`, `pnpm check-types` and `pnpm test` before you push. Say what
you verified — the tests reach the packages and the app's service layer but not
its pages.

Storage providers are the extension point, and yours doesn't have to live here.
A package published by anyone can be installed and named in the config.

## License

MIT — see [LICENSE](LICENSE).

That covers the code in this repository. The app and the Docker image also ship
other people's, under their own terms, listed in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

None of it says anything about the books you put in a library built with it,
whose copyright is between you and their publishers.
