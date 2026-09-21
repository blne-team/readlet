# What's missing

What Readlet can't do yet, so you know what you're getting before you commit a
library to it. Roughly in the order it's worth doing.

If you want to work on one of these, say so on
[the issue tracker](https://github.com/blne-team/readlet/issues) first — most
of these are larger than they look.

## Know this before you deploy

**Readlet requires Cloudflare Access for its browser interface.** A deployment
must supply its signed identity token and configure a bootstrap manager.
Dedicated OPDS clients use revocable per-user app passwords instead.

**Nothing is encrypted.** Your library is published in the clear, and sync
object keys contain slugified titles — so a listing of your storage names your shelf.
Whoever holds the storage can read every book. With the filesystem provider you
can put the directory on an encrypted volume today; see
[encrypting your library](providers/fs.md#encrypting-your-library-at-rest).

**Two devices reading as one user at the same time is last-write-wins.** Read
the same book on two screens at once and one of them loses its place.

## Planned next

Where reading and browsing are thin rather than absent.

- **A page per book.** Your books' descriptions are read, published, and never
  shown, because there's no page where a book's own details live. The shelf row
  crowds the actions together and there's nowhere to see a large cover.
- **Sorting, filtering, and a shelf that scales.** Search covers the published
  metadata and folds accents, but there are no interactive filters or relevance
  ranking, and the browser shelf still renders every book at once.
- **Search inside an EPUB.** PDFs are searchable; EPUBs aren't.

## Later

Bigger, and each one arguably a project of its own.

- **More formats.** CBZ, MOBI/AZW3, FB2, DjVu, plain text and Markdown. MOBI and
  AZW3 matter most, since that's what a decade of Kindle libraries are stored
  as. Unencrypted files only — Readlet does not circumvent DRM and won't take
  contributions that do.
- **Publishing that knows what changed.** Every `pnpm sync` rebuilds the
  whole tree: every book re-read, every PDF cover re-rendered. A library of a
  thousand books costs a full rebuild to add one.
- **Offline reading.**
- **A library the server cannot read.** End-to-end encryption, so your storage
  provider and a leaked bucket both see ciphertext. This is the largest item
  here, it can't coexist with the OPDS catalog, and it's no defence against a
  compromised app host.

## Someday

Nothing here is load-bearing.

- **Reading statistics** — time read, books finished, pace.
- **Collections** — hand-made shelves alongside the automatic ones.
- **Send to device** — email an EPUB to a Kindle address, or a QR code to open
  a book on your phone.
- **Merging positions properly** across two devices.
- **A conversion pipeline** — EPUB from PDF, EPUB from MOBI.
- **Interface localization**, and grouping the shelf by the language its books
  are in.
- **Accessibility beyond the basics** — focus management in the reader's iframe,
  announcements on page turns, a keyboard shortcut sheet.

## Not planned

Stated so each is a decision rather than an oversight.

- **A metadata editor.** Your library is regenerable by design — the thing to
  edit is the source book, not the published catalog.
- **Fetching metadata from the internet.** Google Books and OpenLibrary would
  fill in what a file lacks, and would also make publishing depend on someone
  else's uptime. If it ever happens it'll be opt-in and cached.
- **Social features.** Not what this is.
- **DRM circumvention.** Readlet reads files you can already open.
