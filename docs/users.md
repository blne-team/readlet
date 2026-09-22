# Users

Cloudflare Access authenticates a person; Readlet decides whether that identity
belongs to this library. Every active Readlet user has private reading
positions, bookmarks, highlights, and notes.

## The first manager

Set `READLET_BOOTSTRAP_MANAGER_EMAIL` to the email that owns the library. For an
R2 deployment, that exact verified Access identity also owns the one-time setup
page. When they open the installed library, the empty user directory is created
and that person becomes its first manager. No other visitor can initialize the
library.

The bootstrap setting is not used to grant a role after the directory exists.
Readlet keeps at least one active manager, so the last one cannot be disabled,
demoted, rebound, or deleted.

## Managing readers

A manager opens the avatar menu on the shelf and chooses **Users** (`/users`).
They can:

- invite an email as a member or manager;
- change its display name or role;
- disable and re-enable access;
- clear a stale Cloudflare identity binding so the email can bind again;
- create, replace, or revoke an OPDS app password; and
- delete the user and their reading state.

Deletion first denies the user, then removes their reading state, then removes
their directory record. If storage fails partway through, the user remains in
`deleting` status and cannot sign in; the manager can use **Finish deletion**
after storage recovers.

An invitation starts as pending. The first Access token carrying that verified
email binds its Cloudflare `sub` to the Readlet user and activates it. Later
requests resolve by `sub`, not by email. A changed verified email updates the
same user without changing their reading-state key.

Managers administer users but cannot switch into another user's reading state.

An OPDS password is shown once and stored only as a salted hash. It authenticates
that user on the catalog, cover, and download routes without creating a browser
session. Replacing it immediately revokes the previous password; disabling or
deleting the user also prevents it from authenticating.

## Reading on more than one device

Both devices resolve to the same user and therefore the same progress and
marks. The newest saved position wins. Reading the same book simultaneously on
two devices remains last-write-wins.
