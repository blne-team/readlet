# The library format

What the sync tool writes, so you know what you're backing up and what you can
safely change.

## The layout

One folder per book, plus a generated catalog:

```
library/
  sync-the-time-machine/
    metadata.json          what the book says about itself
    cover.webp
    sync-the-time-machine.epub
    sync-the-time-machine.pdf   any number of formats
  catalog.json             generated from every metadata.json
  .readlet/              written by the app, not the sync tool
    users.json
    progress/<user>.json
```

Folders contributed by `pnpm sync` use `sync-` followed by the slugified title.
The prefix keeps them distinct from books imported through the app, so either
publishing path can update its own books without deleting the other's.

## metadata.json

Holds what the book records about itself: title, authors, publisher, date,
language, identifier, ISBN, description, subjects, series, and a page count for
formats that have one. Readlet also records `addedAt` and `modifiedAt`; a sync
preserves them when the previously published book is unchanged.

Of the metadata extracted from the publication, only the title is required. A
book that doesn't record a publisher or a date is normal, not broken. For how
each format stores this and how far it's trusted, see
[publishing](publishing.md#what-ends-up-on-your-shelf).

## catalog.json

Generated from every `metadata.json` in the library. Catalog format version 2
requires the per-book timestamps used by OPDS recent and updated feeds.

## .readlet/

Your users and reading positions. This is the only thing in the library the
sync tool didn't put there, and it never removes it.

## What to back up

Back up your books, and back up `.readlet/`.

Everything else regenerates. If you lose the library but still have your
original files, `pnpm sync` rebuilds all of it. If you lose `.readlet/`,
everyone's membership and reading positions are gone.
