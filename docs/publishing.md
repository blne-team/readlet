# Publishing a library

Managers can now add EPUBs and PDFs from `/manage`: upload a file from your
device or paste a public HTTPS file URL. Readlet publishes the file to the
configured storage provider, extracts its metadata, and adds it to the shelf.
Each import is limited to 100 MB. EPUB covers are used as provided;
browser-imported PDFs currently have no generated cover.

For a PDF or EPUB hosted on GitHub, paste the file page or its **Raw** link.
Readlet follows the file page to the downloadable file. A URL starting with
`blob:` is a temporary browser address, even when it contains
`https://github.com`; download that file in the browser and upload it instead.
URL imports need the file server to provide its size in the `Content-Length`
response header.

`pnpm sync` contributes a local folder to the same catalog. It owns books whose
ids begin with `sync-`; books added through `/manage` are preserved. With the
R2 provider, each uploaded object must fit the Cloudflare Worker request body
limit because sync uses the same Worker path.

## Publish your books

Put your EPUBs and PDFs in `books/`, then run:

```bash
pnpm sync
```

If you ran `pnpm demo` first, empty `books/` before adding your own — the
generated titles would otherwise publish alongside them and be tedious to tell
apart. (`pnpm demo` refuses a folder that already has books in it, so the
other order is safe.)

That builds `library/` and uploads it. Use a dry run to inspect the result:

```bash
pnpm sync --dry-run   # build it, upload nothing — check the result first
```

Run `--dry-run` the first time. It writes `library/` and prints what each book
turned into, so you can see whether your titles and covers came out right before
anything leaves your machine.

## Configure where things go

Create `readlet.config.json` in the project root:

```json
{
  "input": "books",
  "output": "library",
  "coverHeight": 240,
  "storage": {
    "provider": "r2",
    "endpoint": "https://readlet.example.com/api/library/sync"
  }
}
```

| key | what it does |
| --- | --- |
| `input` | the folder your books are in. Default `books` |
| `output` | where the built library is written. Default `library` |
| `coverHeight` | cover thumbnail height in pixels. Default 240 |
| `storage.provider` | `r2` or `fs`, or the name of a provider package you installed |

You can skip the file entirely if you use the default layout — `books/` in,
`library/` out.

Everything under `storage` other than `provider` is passed straight to the
provider. For what your provider accepts, see [R2](providers/r2.md) or
[filesystem](providers/fs.md).

The tool looks for the config by walking up from wherever you run it, so you can
run it from a subdirectory.

## Flags

| flag | what it does |
| --- | --- |
| `--dry-run` | build the tree, publish nothing |
| `--provider NAME` | publish through a different provider than the config names |
| `--size N` | cover thumbnail height in pixels |
| `--full` | keep full-size covers instead of thumbnailing them |

## Adding and removing books

Add a book to `books/` and run `pnpm sync` again. Delete one and run it again,
and that sync-owned book disappears from your shelf. Books imported through
`/manage` remain untouched.

Sync never touches your users or reading positions. Those live in
`.readlet/`, and nothing the sync tool does will remove them.

## Give one book several formats

Name the files the same thing:

```
books/
  the-time-machine.epub
  the-time-machine.pdf
```

Those become one book on your shelf, with both formats offered for download.

## What ends up on your shelf

Titles, authors, publishers and dates come out of the books themselves. Nothing
is looked up online and nothing is guessed from a file name, so what you see is
what your files say about themselves.

**EPUB** metadata is usually right: title, authors, publisher, date, language,
identifier, description, subjects, and a series if Calibre or an EPUB 3
collection recorded one.

**PDF** metadata is less reliable, because PDF writers fill the title field in
with whatever is to hand. Titles that are obviously not titles get rejected:

| recorded title | what happens |
| --- | --- |
| `Acme DPA v6.4.docx` | rejected — a file name with its extension |
| `Microsoft Word - acme-terms.doc` | rejected — the program's doing |
| `untitled`, `Slide 1`, blank | rejected — says nothing |
| `quarterlynotes`, for `quarterlynotes.pdf` | rejected — the file's own name |
| `Skia/PDF m149`, where that is also the producer | rejected — the tool's name |
| `acme-brochure-v1.3-web` | kept — ugly, but it's what the document calls itself |

When a title is rejected, the next place it might be recorded is tried, and
failing that the file name is used.

Two things to expect from PDFs:

- **The date is the file's, not the book's.** A PDF records when the file was
  written, which for a scan or a re-export isn't when the book came out. It's
  published as a date without a time.
- **An ISBN only appears if its check digit is valid.** Publishers put all kinds
  of things in the identifier field, so unverified numbers are left off rather
  than shown as an ISBN.

### If a book imports wrongly

Check what the book itself says first. For an EPUB, unzip it, find the `.opf`
named in `META-INF/container.xml`, and look at its `<metadata>` block — that's
exactly what the sync tool reads. If the title is wrong there, it'll be wrong on
your shelf.

If a book is marked `[encrypted, no metadata]`, it's a PDF with the
permissions-only encryption some publishers apply. The book still publishes and
still gets a cover; only its metadata is unavailable.

Still stuck? [Open an issue](https://github.com/blne-team/readlet/issues/new/choose)
with that metadata block. Please don't attach the book.

## Covers

Covers are thumbnailed to 240px WebP. Install two tools and they'll come out
right:

```bash
brew install webp poppler        # macOS
apt install webp poppler-utils   # Debian, Ubuntu
```

| tool | needed for | without it |
| --- | --- | --- |
| `cwebp` | cover thumbnails | `sips` on macOS; otherwise sync requires `--full` to publish full-size covers |
| `pdftoppm` | covers from PDFs | `sips` or `qlmanage` on macOS, otherwise PDFs get no cover |

`pdftoppm` is optional, but without `cwebp` or macOS `sips`, sync requires
`--full`. A shelf of untouched publisher covers costs around 65 MB against
0.5 MB thumbnailed, so it's worth installing a scaler.

Use `--full` if you want the original covers kept at their own size.

The Docker image ships both tools, so there's nothing to install on that route.

## Disk space

Book files are hard-linked into `library/` rather than copied, so publishing
763 MB of books costs about a megabyte of disk.
