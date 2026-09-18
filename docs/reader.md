# Reading in the browser

Every book on your shelf has a **Read** link. EPUBs and PDFs each get a reader
built for them; anything else opens in your browser's own viewer.

Books open where you left off, and the **Continue** button on the shelf takes
you straight back to the one you're part-way through.

## Controls

Both readers share the same controls.

| | |
| --- | --- |
| **View** | paged or continuous scroll |
| **Text** | font size, family, weight, line and paragraph spacing, letter spacing and alignment (EPUB) |
| **Page** | margins, maximum text width and automatic, one- or two-column layout (EPUB) |
| **Contents** | open the left panel on a wide screen or a drawer on a phone; jump to a chapter or PDF section |
| **Progress** | EPUB: book % and chapter % once measured; PDF: page of a total and a progress line |
| **Page theme** | EPUB: match the device, paper, sepia or night; PDF: paper, sepia or night tint |
| **Download** | the file itself |
| **Bookmark** | save the current EPUB location or PDF page to your user |
| **Highlights** | select text, choose a color, then highlight it or add an optional note |

The selection menu waits for your choice before saving anything. On a phone it
opens as a bottom sheet, so its controls stay clear of the page-turn edges.
Bookmarks and highlights belong to the active user and appear on another
device when you open the same book there. The Marks tab lets you jump back to
an item, edit a highlight's note, or delete it. It can also download the open
book's bookmarks and highlights as Markdown or JSON — empty exports are honest
empty sections or an empty JSON array, not a pretend success. On a read-only
library, marks can be viewed but cannot be changed.

**Keyboard**, in the page-at-a-time layouts:

| | |
| --- | --- |
| arrows, page up / page down | turn the page |
| space, shift-space | turn the page |
| Home, End | the start or end of the book |

In continuous scroll the arrows scroll instead of turning. On a touchscreen,
swipe to turn.

On a narrow screen, a two-page preference becomes one page until there is room
again. The preference itself is left alone, so rotating the device or returning
to a larger screen restores it. On a wide screen, the reader controls share a
single header row and the left panel holds Contents, Marks, and Notes. The PDF
panel also holds page thumbnails and Search. The panel can be closed to give the
book more room. On a phone, the controls appear at the bottom when you tap the
middle of the book and hide again after a short pause. The panel opens as a
drawer. On larger screens the header stays visible while you read. Tap the left
or right edge to turn a paged book.

## PDFs

**Zoom** is automatic by default: fitted to the width of your window, but never
past 125%, because a Letter page blown up to fill a wide monitor sets the body
text at about twenty-four points. Fit-width, fit-page and fixed percentages are
all available, including in the view settings on a phone.

**Search** works over the whole document and runs entirely in your browser.
Results stream in as pages are scanned, and the first search costs one pass over
the document — after that it's instant. Matching ignores case and accents, so
`Bronte` finds `Brontë`, and it matches across line breaks.

PDF highlights follow the selected text's page rectangles when zoom changes.
An EPUB highlight uses a text CFI, so it follows reflow when typography or
the viewport changes.

**Contents** comes from the document's own outline. A PDF without an outline
offers a page jump in the same panel, while page thumbnails remain available.

**Page tint on a PDF is a filter over the page**, not a restyling. A PDF page is
a picture, background and all, so tinting can't work the way it does for an
EPUB. It looks right for text and diagrams and wrong for photographs, which is
why paper is the default.

**You can select and copy text**, and screen readers can read the page, because
the text sits over the page as a transparent layer.

The side panel includes lazy page thumbnails. In paged layouts, the left and
right edges turn pages, horizontal swipes work on touchscreens, and a two-finger
gesture zooms around its midpoint. Pages can also be rotated clockwise.

Display settings group one-page, two-page and continuous layouts with paper,
sepia and night tints, contrast, and page spacing. On phones, the controls hide
after a short pause; tapping the middle of the page brings them back.

## Opening a big book is cheap

You don't download the whole file to start reading. A 40 MB PDF opens on a few
128 KB reads and the rest arrives as you read. An EPUB fetches one chapter at a
time — a cold open costs about 73 KB rather than the whole archive.

Continuous scroll on an EPUB is the exception, at around 1.3 MB, because it
starts at the top of the book and renders the cover.

If you're watching a network log, you'll see the PDF reader make one request for
the whole file and immediately cancel it. That's how it discovers that ranged
requests are available. It transfers almost nothing.

## Downloads resume

An interrupted download continues from where it stopped rather than starting
again. If the book was republished in the meantime, you get the whole of the new
file instead of two halves spliced together.

Your browser may not show a percentage while downloading. The server streams
book files without stating a total length up front, so there's nothing for the
progress bar to count against.

## Where your place is kept

Your current position stays live for the reading session and is saved to the
active user after a short pause. Closing the tab flushes whatever is
outstanding.

An EPUB stores a CFI and spine href. The percentage in the reader chrome is
display-only: it is derived from epub.js locations after they have been
generated for the open book, and is not written back with the position. Until
that measurement is ready, the chrome keeps the chapter label and does not
show a fabricated 0%.

A PDF stores a page number. Its progress line is the current page of the
document total.

Which file it is saved to depends on [which user](users.md) is reading. A
read-only library does not persist position changes.

Text and page preferences, layout, zoom and tint are remembered per device
rather than per user.
