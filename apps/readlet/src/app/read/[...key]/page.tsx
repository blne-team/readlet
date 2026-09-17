import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EpubReader } from "@/app/read/[...key]/epub-reader";
import { PdfReader } from "@/app/read/[...key]/pdf-reader";
import { ReaderShell } from "@/app/read/[...key]/reader-shell";
import { State, StatePage } from "@/app/state";
import { BUTTON_PRIMARY } from "@/app/ui";
import { encodeKey } from "@/lib/http";
import { extension } from "@/lib/media";
import { OG_BASE } from "@/lib/site";
import { bookKey } from "@/services/catalog";
import { getServices } from "@/services/container";
import { ifAvailable } from "@/services/errors";
import { pageUser } from "@/services/session";

/**
 * What a shared book link says about itself.
 *
 * The cover stands in for the OG image, so passing a book to someone shows the
 * book rather than the shelf it came from. It is a portrait image and a large
 * summary card would letterbox it, hence the smaller card here.
 *
 * Reading positions live behind this URL and a library is not a publication, so
 * the page asks not to be indexed. It stays crawlable rather than disallowed in
 * robots.txt, which is what lets a preview be built at all.
 */
export async function generateMetadata(
  props: PageProps<"/read/[...key]">,
): Promise<Metadata> {
  await pageUser();
  const { key } = await props.params;
  const fileKey = key.join("/");
  const [id] = fileKey.split("/");

  // The catalog is memoised per request, so the page's own lookup is free.
  const { catalog } = await getServices();
  const book = await catalog.find(id);
  if (!book) return { robots: { index: false, follow: false } };

  const authors = book.authors.join(", ");
  const cover = book.cover
    ? {
        url: `/cover/${encodeKey(bookKey(book.id, book.cover))}`,
        alt: book.title,
      }
    : undefined;

  return {
    title: book.title,
    description: authors ? `${book.title} by ${authors}` : book.title,
    robots: { index: false, follow: false },
    openGraph: {
      ...OG_BASE,
      type: "book",
      authors: book.authors,
      title: book.title,
      description: authors,
      url: `/read/${encodeKey(fileKey)}`,
      ...(cover ? { images: [cover] } : {}),
    },
    twitter: {
      card: "summary",
      title: book.title,
      description: authors,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

export default async function ReadPage(props: PageProps<"/read/[...key]">) {
  const user = await pageUser();
  const { key } = await props.params;
  const fileKey = key.join("/");
  const [id] = fileKey.split("/");

  const { catalog } = await getServices();

  // Undefined is a library that could not be read, which is not the same as a
  // book that is not in it — one is worth coming back for and the other is not.
  const book = await ifAvailable(() => catalog.find(id));
  if (book === undefined) return <Unreachable />;
  if (!book?.formats.some((f) => fileKey.endsWith(`/${f.file}`))) {
    notFound();
  }

  return (
    <ReaderShell
      title={book.title}
      downloadUrl={`/download/${encodeKey(fileKey)}`}
    >
      {extension(fileKey) === "epub" ? (
        <EpubBody fileKey={fileKey} bookId={book.id} userId={user.id} />
      ) : extension(fileKey) === "pdf" ? (
        <PdfBody fileKey={fileKey} bookId={book.id} userId={user.id} />
      ) : (
        // Anything else is handed to the browser's own viewer, which for a
        // format this app has no reader for is better than nothing. The inline
        // disposition is what stops it downloading instead of displaying.
        <iframe
          src={`/download/${encodeKey(fileKey)}?inline=1`}
          title={book.title}
          className="flex-1 border-0"
        />
      )}
    </ReaderShell>
  );
}

async function EpubBody({
  fileKey,
  bookId,
  userId,
}: {
  fileKey: string;
  bookId: string;
  userId: string;
}) {
  const { content, progress } = await getServices();

  const opened = await ifAvailable(async () => {
    const [opfPath, saved] = await Promise.all([
      // Resolving the package document also proves the archive is readable
      // before the reader is handed anything.
      content.packageDocument(fileKey),
      progress.get(userId, bookId),
    ]);
    return { opfPath, saved };
  });
  if (!opened) return <Unreachable />;

  const { opfPath, saved } = opened;
  if (!opfPath) notFound();

  return (
    <EpubReader
      opfUrl={`/book/${encodeKey(fileKey)}/${encodeKey(opfPath)}`}
      bookId={bookId}
      saved={saved}
      canSync={progress.writable}
    />
  );
}

/**
 * The PDF reader, and what the server can tell it before it starts.
 *
 * Less than the EPUB reader needs: a PDF is one file that the reader fetches
 * itself, in ranges, rather than an archive the app reads chapters out of. So
 * there is nothing to resolve here and nothing to prove reachable — a library
 * that has gone away is reported by `/download`, and the reader says so in the
 * place the page would have been.
 */
async function PdfBody({
  fileKey,
  bookId,
  userId,
}: {
  fileKey: string;
  bookId: string;
  userId: string;
}) {
  const { progress } = await getServices();
  const saved = await progress.get(userId, bookId);

  return (
    <PdfReader
      url={`/download/${encodeKey(fileKey)}`}
      bookId={bookId}
      saved={saved}
      canSync={progress.writable}
    />
  );
}

/** Shown in place of the reader when the book cannot be reached. */
function Unreachable() {
  return (
    <StatePage>
      <State
        icon={CloudOff}
        title="This book is out of reach"
        actions={
          <Link href="/" className={BUTTON_PRIMARY}>
            Back to the shelf
          </Link>
        }
      >
        <p>
          The library cannot be read at the moment, so this book will not open.
          Your place in it is safe — nothing has been written.
        </p>
      </State>
    </StatePage>
  );
}
