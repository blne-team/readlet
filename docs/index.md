---
title: Readlet
---

# Readlet

A self-hosted library for the ebooks you already own. Put your EPUBs and PDFs in
a folder, publish them, and read them in any browser — or on your Kobo, through
the [OPDS catalog](opds.md).

![The shelf: a searchable list of books with covers, the current user, and a Continue button on the book being read](shelf.webp)

Run it as a Cloudflare Worker over R2, or as a Node server over a directory on
your own machine. Both use the same code and the same library.

## Prepare a demo library

```bash
git clone https://github.com/blne-team/readlet.git
cd readlet
pnpm install
pnpm demo
```

That writes nine generated public-domain books into `books/` — eight EPUBs and a
PDF. Nothing is downloaded. Reading them requires a Cloudflare Access-protected
deployment; direct local requests have no signed identity and are denied.

The checked-in `readlet.config.json` points at Cloudflare R2, so `pnpm sync`
goes there unless you change it. For a local look, switch it to the
filesystem provider first:

```jsonc
// readlet.config.json
{ "storage": { "provider": "fs", "directory": "shelf-data" } }
```

There's no hosted demo to visit. `pnpm demo` is the substitute.

## Set up your own

You'll need Node 24 or newer and a Unix-like system. Covers come out better with
`cwebp` and `pdftoppm` installed — or use Docker, which ships both.

### With Docker

The shortest route.

```bash
mkdir books && cp ~/Downloads/*.epub books/
docker compose run --rm sync
docker compose up -d
```

The server listens on <http://localhost:3000>, but direct requests are denied.
Expose it through Cloudflare Access and forward the signed
`Cf-Access-Jwt-Assertion` header before browsing.

Back up the `library` volume. It holds your published books and everything the
app writes to them.

### On a machine you own

Point the config at a directory, publish into it, and run the app. Storage is
local, but the server still needs a Cloudflare Access-protected endpoint and
the three identity variables described in [the Access setup](providers/r2.md#configure-identity-and-the-first-manager):

```jsonc
// readlet.config.json
{ "storage": { "provider": "fs", "directory": "shelf-data" } }
```

```bash
mkdir books && cp ~/Downloads/*.epub books/
pnpm sync
pnpm build
pnpm --filter @readlet/app start
```

See [the filesystem provider](providers/fs.md) for running it on a VPS and for
keeping your library on an encrypted volume.

### On Cloudflare

You'll need a Cloudflare account.

```bash
pnpm --filter @readlet/app exec wrangler login
pnpm run deploy
```

Create a private R2 bucket in the Cloudflare dashboard and attach it to the
deployed Worker with the binding name `BOOKS`. The setup page checks that
credentialless connection and initializes the first manager. See
[the R2 provider](providers/r2.md), configure Access and the sync credentials
described there, then run `pnpm sync`.

## What you get

**Both formats read in the browser.** EPUB and PDF each have a reader built for
them, and a book opens where you left it. Opening a 400-page PDF costs a few
tens of kilobytes rather than the whole file.
[Reading in the browser](reader.md).

**Adding books.** Managers can upload an EPUB or PDF, or paste a public HTTPS
file URL, from `/manage`. Titles and authors come from the files themselves.
The older folder-based sync tool is also available for local publishing.
[Publishing a library](publishing.md).

**Identity-bound reading positions.** Every active user keeps their own place
in every book. [Users](users.md).

**An OPDS catalog.** KOReader, Thorium, Calibre and anything else that speaks
OPDS browses the same library your browser does. [The OPDS catalog](opds.md).

**Your files stay files.** There's no database. A library is a tree of books
plus one `catalog.json`, and all of it regenerates from the books you own — lose
your storage and you've lost an `pnpm sync`, not a collection.
[The library format](library-format.md).

## Before you commit a library to it

**Cloudflare Access authentication is required.** Readlet verifies the signed
Access application token and admits only active users from its own directory.
Configure the first manager before opening the Worker URL.

**Nothing is encrypted.** Your library is stored in the clear, and sync object
keys contain slugified titles — a listing of your storage names your shelf.

**Two devices reading as one user at once is last-write-wins.**

[What's missing](roadmap.md) has the full list.

## Documentation

| | |
| --- | --- |
| [Publishing a library](publishing.md) | the sync tool, its flags, and covers |
| [The library format](library-format.md) | what ends up in storage, and what to back up |
| [Storage providers](providers/) | choosing where your library lives |
| [Cloudflare R2](providers/r2.md) | setup, deploying, publishing locally |
| [Filesystem](providers/fs.md) | your own machine or a VPS |
| [Users](users.md) | membership, managers, and private reading state |
| [Reading in the browser](reader.md) | the readers and their controls |
| [The OPDS catalog](opds.md) | reading on a Kobo, a Kindle, or any OPDS client |
| [Architecture](architecture.md) | for working on the code |
| [What's missing](roadmap.md) | limitations, and what's planned |

The source is on [GitHub](https://github.com/blne-team/readlet).
[CONTRIBUTING.md](https://github.com/blne-team/readlet/blob/main/CONTRIBUTING.md)
covers working on it.

## License

MIT. The app and the Docker image also ship other people's code — pdf.js,
epub.js, React, and the two command-line tools that make covers — under their
own terms, listed in
[THIRD-PARTY-NOTICES.md](https://github.com/blne-team/readlet/blob/main/THIRD-PARTY-NOTICES.md).

None of it says anything about the books you put in a library built with it,
whose copyright is between you and their publishers.
