# Architecture

How the code is laid out, for when you're working on it. If you just want to run
a shelf, you don't need this page.

## The repository

```
apps/readlet       the app: a Next.js Worker, or a Node server
packages/core        the library format, the readers, the provider contract
packages/provider-r2 Cloudflare R2
packages/provider-fs a directory on disk
packages/sync        the CLI that builds a library and publishes it
packages/fixtures    generated books, for tests and the demo shelf
tools/               the demo shelf script
```

It's a Turborepo workspace, so `packages/core` builds before anything that
imports it. Every package is TypeScript compiled by `tsc`; the app is compiled
by Next. Tests live beside the code they exercise as `test/*.test.ts`, and Node
runs them from source.

One task is neither a build nor a test: `assets` copies pdf.js's worker, CMaps,
standard fonts and WebAssembly out of `pdfjs-dist` into the app's `public/`.
Everything that serves the app depends on it. You never need to run it by hand.

## The rule to keep

**The app talks to interfaces, never to Cloudflare.** If you find yourself
importing `@readlet/provider-*` anywhere except
`apps/readlet/src/services/container.ts`, something has gone wrong.

## Services and ports

```
packages/core/src/
  provider.ts     the contract — Storage, StorageAdmin, the manifest
  catalog.ts      the published shape — Book, Catalog, file names, version
  state.ts        the written-back shape — User, Progress, their prefix
  bytes.ts        ByteSource: size() and read(offset, length)
  zip.ts          the ZIP reader, written against ByteSource
  pdf.ts          the PDF reader, likewise

apps/readlet/src/services/
  ports/cache.ts          ResponseCache, plus a no-op
  adapters/workers-cache.ts
  catalog.ts      CatalogService — the shelf, from catalog.json
  library-manager.ts  manager deletion, catalog mutation, resumable cleanup
  content.ts      BookContentService — files from inside a book
  access-identity.ts  verifies Cloudflare Access identity claims
  users.ts        UserService — membership, roles, and identity binding
  progress.ts     ProgressService — how far they got
  errors.ts       the difference between absent and unreachable
  request-user.ts authenticates and authorizes route requests
  session.ts      the current user for pages and Server Actions
  container.ts    createServices() wires them; getServices() is the only
                  place that names a provider
```

Use `setServices()` to substitute fakes in tests.

Three constraints you need to respect when adding to this layer:

- **`Storage` has no `list`.** The catalog enumerates the library, so no request
  can discover books by walking the bucket. Enumeration lives on `StorageAdmin`,
  which never runs in the app.
- **Library management trusts the catalog, never a browser-supplied key.** A
  manager names a book id; `LibraryManagerService` derives its metadata, cover,
  and format keys from the stored catalog. Interrupted deletions remain in the
  private operations file until object and reader-state cleanup finishes.
- **Put every key from a URL through `parseBookKey`.** The three routes that
  serve bytes do this and answer `404` to anything that isn't a file inside a
  book's folder. Without it, a URL can read any object the provider will answer
  for — including `.readlet/users.json`.
- **Narrow with `writableStorage()` before writing.** `write` and `remove` are
  optional on `Storage`. Degrade rather than throwing.

## Absent, or unreachable

Every service tells three states apart.

**Present** and **absent** are both ordinary. An unpublished catalog is an empty
shelf and a book nobody opened has no saved position. None of these fails a
page. A missing user directory is different: only the configured bootstrap
email may create it.

**Unreachable** is storage that exists and is failing. It arrives as
`LibraryUnavailableError`, and each caller answers for itself:

| | when the library cannot be read |
| --- | --- |
| the catalog | the last one read, if there is one; otherwise the shelf says so |
| users | refuses |
| reading positions | none, and a save answers `false` |
| a book's contents | refuses, and the route answers `503` |

When you add a caller, follow that table. Reading positions can be omitted from
the shelf until storage recovers, while the open reader retains its current
in-session position. Saving must not degrade — the file holds every book a
user has open and is rewritten whole, so writing after a failed read would
replace all of them with one. Users never degrade to a guessed identity.

Anything that isn't `LibraryUnavailableError` should throw and reach
`app/error.tsx`.

## The readers

```
apps/readlet/src/app/read/[...key]/
  page.tsx          picks a reader from the extension — the only place that
                    knows there is more than one
  reader-shell.tsx  viewport, safe areas and shared immersive chrome
  epub-reader.tsx   coordinates EPUB state and feature modules
  epub-runtime.ts   owns the epub.js rendition lifecycle
  epub-interactions.ts keyboard, pointer and touch gestures
  epub-controls.tsx navigation and toolbar
  pdf-reader.tsx    coordinates PDF state, position and chrome
  pdf-engine.ts     one imperative boundary around the PDF.js viewer
  pdf-runtime.ts    loads and configures PDF.js before its dependent viewer
  pdf-viewer-lifecycle.ts  initializes pages before first paint
  pdf-viewer-startup.ts  overlaps viewer code and ranged document reads
  pdf-surface.tsx   viewer host, keyboard, pointer and touch gestures
  pdf-controls.tsx  navigation and the compact toolbar
  pdf-sidebar.tsx   contents and search
  pdf-thumbnails.tsx lazy page previews
  pdf-document.ts   document opening and outline resolution
  features/
    annotations/    selection menu and EPUB/PDF highlight rendering
    appearance/     format-specific preferences and controls
    bookmarks/      bookmark presentation
    progress/       in-session position and debounced user-state sync
    reader-marks/   user mark loading, mutations and shared panel
    search/         the debounced, streamed PDF text index

apps/readlet/src/lib/local.ts   localStorage for device display preferences
```

Both readers are client components and load their library with a dynamic
`import()` — epub.js and pdf.js each reach for `window` as they initialise and
neither survives the server render.

## The OPDS catalog

```
apps/readlet/src/app/opds/[[...path]]/route.ts   the whole route
apps/readlet/src/lib/opds/
  feed.ts         the model, shaped after OPDS 2.0
  browse.ts       the groupings: by author, by subject, by series
  xml.ts          escaping
  atom.ts         OPDS 1.2, and the OpenSearch document
  json.ts         OPDS 2.0
  serve.ts        the URL space, format negotiation, the ETag, the response
```

**Don't import `next/headers` under `lib/opds/`.** `serveOpds` takes the shelf
and the origin as parameters, which is what keeps every feed reachable from
`test/opds.test.ts`. That's also why `siteOrigin()` lives in `lib/origin.ts`
rather than in `lib/site.ts`.

## Error pages

```
apps/readlet/src/app/
  state.tsx         the shared block: glyph, title, sentence, a way out
  not-found.tsx     a URL that matches nothing
  error.tsx         the route boundary
  global-error.tsx  when the root layout itself failed
```

`error.tsx` shows the digest rather than the message — Next redacts messages in
production.

## Caching

The catalog is held in an in-isolate memo backed by the Workers Cache API for 60
seconds. Covers carry `max-age=86400` with an ETag. OPDS feeds carry
`private, max-age=60`, a weak ETag, and `Vary: Accept`.
