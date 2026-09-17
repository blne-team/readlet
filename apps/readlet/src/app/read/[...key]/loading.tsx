import Link from "next/link";
import { ReaderLoading } from "./reader-loading";

export default function Loading() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="reader-topbar border-b border-separator">
        <Link href="/" className="text-sm text-secondary hover:text-foreground">
          ← Shelf
        </Link>
      </header>
      <main className="grid flex-1 place-items-center">
        <ReaderLoading />
      </main>
    </div>
  );
}
