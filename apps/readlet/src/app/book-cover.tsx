import type { Book } from "@readlet/core";
import { encodeKey } from "@/lib/http";
import { placeholder, tint } from "@/lib/media";
import { bookKey } from "@/services/catalog";

const COVER_CLASS = "h-15 w-10 shrink-0 rounded ring-1 ring-separator";

export function BookCover({ book }: { book: Book }) {
  if (book.cover) {
    return (
      // biome-ignore lint/performance/noImgElement: bucket object served by the Worker, not a static asset
      <img
        src={`/cover/${encodeKey(bookKey(book.id, book.cover))}`}
        alt=""
        width={40}
        height={60}
        loading="lazy"
        decoding="async"
        className={`${COVER_CLASS} object-cover`}
      />
    );
  }

  const { initials, hue } = placeholder(book.title);
  return (
    <div
      aria-hidden="true"
      className={`${COVER_CLASS} flex items-center justify-center text-sm font-semibold text-white/90`}
      style={{ backgroundImage: tint(hue) }}
    >
      {initials}
    </div>
  );
}
