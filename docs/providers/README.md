# Storage providers

A provider decides where your library lives. Two ship with the project, and you
can install someone else's.

## Choosing one

| | [Cloudflare R2](r2.md) | [Filesystem](fs.md) |
| --- | --- | --- |
| your library lives in | an R2 bucket | a directory on disk |
| the app runs as | a Cloudflare Worker | a Node server |
| you need | a Cloudflare account | nothing |
| costs | R2 pricing | nothing |
| good for | reaching your shelf from anywhere | a machine on your own network, or a VPS |

Pick `fs` if you want to own the whole thing and have somewhere to run it. Pick
`r2` if you'd rather not run a server.

## Setting one

Name it in `readlet.config.json`:

```jsonc
{ "storage": { "provider": "fs", "directory": "shelf-data" } }
```

```jsonc
{ "storage": { "provider": "r2", "endpoint": "https://readlet.example.com/api/library/sync" } }
```

Everything under `storage` other than `provider` belongs to that provider. See
its page for what it accepts.

## What each one can do

| | `r2` | `fs` |
| --- | --- | --- |
| serve books | yes | yes |
| resume an interrupted download | yes | yes |
| the app can write users and positions | yes | yes |
| sync credentials to set up | a Cloudflare Access service token | none |

## Using a third-party provider

Install it and name it:

```bash
pnpm --filter @readlet/sync add some-readlet-provider
```

```jsonc
{ "storage": { "provider": "some-readlet-provider", "...": "..." } }
```

Anything that isn't `r2` or `fs` is imported as given, so there's nothing to
register.

## Writing your own

See [CONTRIBUTING.md](https://github.com/blne-team/readlet/blob/main/CONTRIBUTING.md#adding-a-storage-provider).
You don't have to contribute it back — a package published by anyone works.
