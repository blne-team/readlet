# Security

## Reporting a vulnerability

Don't open a public issue for anything exploitable. Use
[private vulnerability reporting][report] instead — it opens a private thread
with the maintainer so a fix can be ready before any of it is public.

[report]: https://github.com/blne-team/readlet/security/advisories/new

Tell us what an attacker gets, and the shortest path to seeing it happen. The
shapes worth writing up:

- a key that escapes the library
- a way to reach one user's reading positions from another
- a request that makes the Worker serve bytes from outside the configured bucket

This is a side project with one maintainer, so treat any timeline as best
effort. You'll get an acknowledgement; you may not get it the same day.

## Supported versions

There are no releases yet. `main` is the only version that gets fixes, so a
self-hosted instance needs to pull and redeploy to receive one.

## What isn't a vulnerability

Two things are missing by design rather than by oversight. Please don't report
them.

**Cloudflare Access is the authentication provider.** Readlet does not provide
passwords or an alternative login system. A deployment without valid Access
configuration is incomplete; bypassing Access at the network edge is a
deployment error. Readlet still verifies every token and checks its internal
membership before serving private data.

**Whatever you put in a library is served.** The sync tool publishes what you
point it at. Deciding what belongs in a public bucket is yours to make.

**A library is stored in the clear.** Books, covers and the catalog are
published as they are, and object keys are slugified titles — so whoever holds
your storage can read your shelf, and so can anything able to list the bucket.
[What's missing](docs/roadmap.md) covers what changing that would take, and
[the filesystem provider](docs/providers/fs.md#encrypting-your-library-at-rest)
covers encrypting a library at rest today.
