# Readlet

[![CI](https://github.com/blne-team/readlet/actions/workflows/ci.yml/badge.svg)](https://github.com/blne-team/readlet/actions/workflows/ci.yml)

Readlet is a self-hosted library for EPUB and PDF books. Add books from your
browser, search your shelf, read or download a book, and pick up where you left
off. Each reader has their own saved position, bookmarks, and highlights.

Run Readlet with a local directory in Docker or on a Node server, or deploy it
to Cloudflare Workers with R2. Managers add books by uploading a file or pasting
a public HTTPS file URL at `/manage`; they can also remove books and manage
readers. An import accepts an EPUB or PDF up to 100 MB.

## Get started with Docker

1. Clone the repository and copy the environment template:

   ```bash
   git clone https://github.com/blne-team/readlet.git
   cd readlet
   cp apps/readlet/.env.example apps/readlet/.env.local
   ```

2. Set `READLET_ACCESS_TEAM_DOMAIN`, `READLET_ACCESS_AUD`, and
   `READLET_BOOTSTRAP_MANAGER_EMAIL` in `apps/readlet/.env.local`. Protect the
   public endpoint with Cloudflare Access and forward its signed
   `Cf-Access-Jwt-Assertion` header to the app. Readlet verifies that token on
   every private request. Direct visits to `localhost:3000` have no Access
   identity and are denied.

3. Start the app, sign in with the bootstrap manager email, and open **Books**
   from the account menu to import your first book:

   ```bash
   docker compose up -d --build
   ```

Compose stores books, users, and reading state in the `library` volume. Back up
that volume as part of your normal backup plan. The Docker image already uses
the filesystem storage provider, so you do not need to edit the checked-in R2
configuration for this path. See [filesystem setup](docs/providers/fs.md) for
running the Node server without Docker.

## Deploy to Cloudflare

Readlet can run as a Worker with a private R2 bucket. Connect the repository to
Cloudflare, configure Access and the three identity variables above, then sign
in as the bootstrap manager. Readlet's first-run page guides you through
creating a private bucket and attaching it as the Worker's credentialless
`BOOKS` binding. Follow the [deployment guide](DEPLOYMENT.md) for the complete
flow. Once setup finishes, add books at `/manage`.

## Use the library

- **Books:** Search the shelf, open an EPUB or PDF in the browser, or download
  the original file. Managers can upload files, import public HTTPS links, and
  delete books at `/manage`. A URL import needs the remote server to provide a
  file size. GitHub file pages and Raw links are supported.
- **Reading:** EPUB and PDF readers save progress, bookmarks, and highlights per
  user. Appearance preferences stay on the device. See [reader controls](docs/reader.md).
- **People:** The first verified email configured as the bootstrap manager
  creates the user directory. Managers invite, disable, and remove readers at
  `/users`. See [user management](docs/users.md).
- **OPDS:** The catalog is available at `/opds`. Managers create scoped app
  passwords for dedicated readers on the Users page. See
  [OPDS and Access](docs/opds.md#access-and-opds-clients) before connecting a
  device.

Readlet stores book files and app state in the configured directory or R2
bucket. Storage is not encrypted by Readlet. Reading changes made at the same
time on two devices for one user use the last saved value.

## Develop locally

The repository requires Node.js 24 or newer and pnpm 10.34.5. The checked-in
`readlet.config.json` targets R2. To run locally without Cloudflare bindings,
use the filesystem development command:

```bash
pnpm install
pnpm dev:no-auth
```

This command uses `shelf-data/` by default, or the directory in a filesystem
`readlet.config.json`. On first run, it fills an empty directory with sample
EPUB and PDF books. Later runs leave an existing library alone. It supplies a
synthetic reader, so it lets you inspect the shelf and reader without Cloudflare
Access. It cannot open manager pages or import books. Production requests always
require a verified Access identity.
For commands and configuration details, see [the provider documentation](docs/providers/README.md)
and [the architecture guide](docs/architecture.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The main checks are `pnpm lint`,
`pnpm check-types`, and `pnpm test`.

## License

MIT — see [LICENSE](LICENSE). Third-party code shipped with the app and Docker
image has its own terms in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
