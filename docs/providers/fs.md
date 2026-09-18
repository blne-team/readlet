# The filesystem provider

Keeps your library in a directory, on your own machine or a VPS. Storage is
local, but authentication still requires Cloudflare Access.

## Setting it up

Point the config at a directory:

```jsonc
// readlet.config.json
{ "storage": { "provider": "fs", "directory": "shelf-data" } }
```

Then publish and run:

```bash
pnpm sync --create   # creates shelf-data/ and publishes into it
pnpm build
pnpm --filter @readlet/app start
```

The server listens on <http://localhost:3000>, but direct browser requests
are denied. Expose it only through a Cloudflare Access-protected endpoint that
forwards `Cf-Access-Jwt-Assertion` and set `READLET_ACCESS_TEAM_DOMAIN`,
`READLET_ACCESS_AUD`, and `READLET_BOOTSTRAP_MANAGER_EMAIL` on the server.
In a repository checkout, copy `apps/readlet/.env.example` to
`apps/readlet/.env.local` and fill it in; Next reads that app-level file at
startup. Docker Compose supplies the same file to its app container.
Readlet verifies the signed token and its own user directory for every private
request in a built deployment. There is no local-login mode.

For a temporary local development session, run `pnpm dev:no-auth` from the
repository root. It supplies a synthetic member only under `next dev`; it does
not alter the user directory and has no effect on a production server or
Worker. The command selects the filesystem provider and uses `shelf-data/` if
the config does not specify a filesystem directory. It does not start the
Cloudflare development proxy or its unsupported internal Durable Object.
An empty local library is filled with sample EPUB and PDF books on first run;
an existing library is left alone.
Keep Cloudflare Access in front of every reachable deployment.

| key | what it does |
| --- | --- |
| `directory` | where the published library lives. Relative paths resolve from the project root |

Keep that directory out of your repository. `shelf-data/` is already gitignored.

## Rebuild after you change the config

`readlet.config.json` is read at build time and baked into the bundle, so if
you change `directory` you have to `pnpm build` again before the app picks it
up.

To point a running deployment somewhere else without rebuilding, set
`READLET_PROVIDER` and `READLET_DIRECTORY` at startup. Those override what
was baked in.

## Encrypting your library at rest

`directory` is just a path, so put it inside an encrypted mount:

```jsonc
// readlet.config.json
{ "storage": { "provider": "fs", "directory": "/mnt/shelf" } }
```

[gocryptfs](https://github.com/rfjakob/gocryptfs) and
[Cryptomator](https://cryptomator.org) both work. There's no flag to set and no
change to the app.

**Know what this protects.** It covers a disk that gets stolen, a backup that
ends up somewhere it shouldn't, and a host that can read your filesystem but
isn't running your app. It does **not** protect your library from the machine
serving it — the mount is open exactly while the app is reading through it. And
it does nothing for R2, where your storage isn't a filesystem at all.

Expect publishing to be slower into a FUSE mount: books are copied there rather
than hard-linked.

## Troubleshooting

**Your shelf is empty and you built for Cloudflare.** Building for Cloudflare
and then starting the app on Node doesn't fail outright — it shows you whatever
the local miniflare bucket holds, which is usually nothing. The app detects this
and says so at startup. Set `provider` to `fs` and run `pnpm build` again.

**The app won't start, saying it has no directory.** A filesystem build with no
directory configured fails deliberately rather than serving an empty shelf.
Check `storage.directory` in your config, or `READLET_DIRECTORY`.

**Permission denied writing to the directory.** The app writes users and
reading positions into `.readlet/` inside it. Make sure the user running the
app owns it:

```bash
chown -R youruser /srv/readlet
```

If the directory genuinely can't be written to, the shelf still serves books —
position changes last for the current reading session.
