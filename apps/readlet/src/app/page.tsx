import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccountMenu } from "@/app/account-menu";
import { Avatar } from "@/app/avatar";
import { BookCover } from "@/app/book-cover";
import { SearchInput } from "@/app/search-input";
import { State } from "@/app/state";
import { BUTTON_PRIMARY, BUTTON_QUIET } from "@/app/ui";
import { encodeKey } from "@/lib/http";
import { OPDS_ALTERNATE } from "@/lib/opds/feed";
import { bookKey, readableFormat } from "@/services/catalog";
import { getServices } from "@/services/container";
import { ifAvailable } from "@/services/errors";
import { pageUser } from "@/services/session";

/**
 * Searching filters through `?q=`, and every one of those is the same shelf
 * seen through a slot. The canonical points at the whole thing so a search
 * someone happened to share is not indexed as a page of its own.
 *
 * The catalog link is repeated from the layout because this replaces its
 * `alternates` rather than adding to them — see {@link OPDS_ALTERNATE}.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/", types: OPDS_ALTERNATE },
};

function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size < 10 && unit > 0 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

export default async function Home(props: PageProps<"/">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";

  const here = query ? `/?q=${encodeURIComponent(query)}` : "/";
  const user = await pageUser();
  const { catalog, progress } = await getServices();

  /*
   * Reading positions are useful but not worth losing a reachable shelf for.
   */
  const positions = await ifAvailable(() => progress.all(user.id));

  // The catalog is the shelf, so this is the one read the page cannot do
  // without — but it still degrades to a state that can say what happened
  // rather than to the error boundary.
  const shelf = await ifAvailable(async () => {
    const [matching, all] = await Promise.all([
      catalog.search(query),
      catalog.all(),
    ]);
    return { matching, total: all.length };
  });

  return (
    <main className="page-safe mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Readlet</h1>

        {user.role === "manager" ? (
          <AccountMenu name={user.displayName} />
        ) : (
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Avatar name={user.displayName} size={28} />
            <span className="hidden max-w-48 truncate sm:inline">
              {user.displayName}
            </span>
          </div>
        )}
      </div>

      {!shelf ? (
        <div className="mt-20">
          <State
            icon={CloudOff}
            title="The library is unreachable"
            actions={
              // A plain anchor rather than a Link: the point is a fresh request
              // rather than whatever the router already has.
              <a href={here} className={BUTTON_PRIMARY}>
                Try again
              </a>
            }
          >
            <p>
              Your books are where they were — this shelf just cannot read them
              at the moment. Nothing has been lost, and nobody&rsquo;s reading
              position has been touched.
            </p>
          </State>
        </div>
      ) : (
        <>
          <SearchInput query={query} />

          {shelf.matching.length === 0 ? (
            <p className="mt-10 text-secondary">
              {shelf.total === 0
                ? "No catalog published yet. Run the publish script and upload its output."
                : `No books match “${query}”.`}
            </p>
          ) : (
            <ul className="mt-8 divide-y divide-separator sm:mt-10">
              {shelf.matching.map((book) => {
                const readable = readableFormat(book);

                return (
                  <li
                    key={book.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                      <BookCover book={book} />
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium sm:truncate">
                          {book.title}
                        </p>
                        <p className="mt-1 break-words text-sm text-secondary sm:truncate">
                          {book.authors.join(", ")}
                        </p>
                        <p className="mt-0.5 break-words text-xs leading-relaxed text-tertiary sm:truncate">
                          {[
                            book.published?.slice(0, 4),
                            book.publisher,
                            book.formats
                              .map(
                                (f) =>
                                  `${f.format.toUpperCase()} ${formatSize(f.size)}`,
                              )
                              .join(" · "),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1 pl-14 sm:gap-2 sm:pl-0">
                      {readable && (
                        <Link
                          href={`/read/${encodeKey(bookKey(book.id, readable.file))}`}
                          className={BUTTON_PRIMARY}
                        >
                          {positions?.[book.id] ? "Continue" : "Read"}
                        </Link>
                      )}
                      {book.formats.map((format) => (
                        <a
                          key={format.file}
                          href={`/download/${encodeKey(bookKey(book.id, format.file))}`}
                          download
                          className={BUTTON_QUIET}
                        >
                          {format.format.toUpperCase()}
                        </a>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
