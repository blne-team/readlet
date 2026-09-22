import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookCover } from "@/app/book-cover";
import { deleteBook } from "@/app/manage/actions";
import { DeleteBookButton } from "@/app/manage/delete-book-button";
import { ImportBook } from "@/app/manage/import-book";
import { PendingDeletionRefresh } from "@/app/manage/pending-deletion-refresh";
import { ManagementHeader } from "@/app/management-header";
import { OG_BASE, SITE_DESCRIPTION } from "@/lib/site";
import { getServices } from "@/services/container";
import { pageUser } from "@/services/session";

export const metadata: Metadata = {
  title: "Books",
  robots: { index: false, follow: false },
  openGraph: { ...OG_BASE, title: "Books", url: "/manage" },
  twitter: {
    card: "summary",
    title: "Books",
    description: SITE_DESCRIPTION,
  },
};

export default async function ManagePage() {
  const actor = await pageUser();
  if (actor.role !== "manager") redirect("/");

  const { catalog, library } = await getServices();
  const [books, pending] = await Promise.all([
    catalog.all(),
    library.pendingDeletions(),
  ]);
  const pendingIds = new Set(pending.map(({ book }) => book.id));
  const available = books.filter((book) => !pendingIds.has(book.id));

  return (
    <main className="page-safe mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <ManagementHeader name={actor.displayName} current="/manage" />

      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Books</h1>
      <p className="mt-2 text-secondary">
        Add EPUBs and PDFs, or remove books and their saved reader entries.
      </p>

      {library.writable && <ImportBook />}

      {pending.length > 0 && (
        <section className="mt-10 rounded-2xl bg-amber-500/10 p-4 sm:p-5">
          <PendingDeletionRefresh />
          <h2 className="font-semibold">Finishing deletion</h2>
          <p className="mt-1 text-sm text-secondary">
            These books are already off the shelf. If cleanup does not finish,
            use Finish deletion to retry.
          </p>
          <ul className="mt-3 divide-y divide-amber-500/20">
            {pending.map(({ book }) => (
              <li
                key={book.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="min-w-0 truncate font-medium">
                  {book.title}
                </span>
                {library.writable ? (
                  <form action={deleteBook}>
                    <input type="hidden" name="id" value={book.id} />
                    <input type="hidden" name="retry" value="1" />
                    <DeleteBookButton title={book.title} retry />
                  </form>
                ) : (
                  <span className="text-sm text-secondary">Read only</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold">Books</h2>
          <span className="text-sm text-secondary">
            {available.length} {available.length === 1 ? "book" : "books"}
          </span>
        </div>

        {available.length === 0 ? (
          <p className="mt-6 text-secondary">There are no books to manage.</p>
        ) : (
          <ul className="mt-4 divide-y divide-separator">
            {available.map((book) => (
              <li
                key={book.id}
                className="flex items-center gap-3 py-4 sm:gap-4"
              >
                <BookCover book={book} />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium sm:truncate">
                    {book.title}
                  </p>
                  <p className="mt-1 break-words text-sm text-secondary sm:truncate">
                    {book.authors.join(", ") || "Unknown author"}
                  </p>
                  <p className="mt-0.5 text-xs uppercase text-tertiary">
                    {book.formats.map((format) => format.format).join(" · ")}
                  </p>
                </div>
                {library.writable && (
                  <form action={deleteBook}>
                    <input type="hidden" name="id" value={book.id} />
                    <DeleteBookButton title={book.title} />
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
