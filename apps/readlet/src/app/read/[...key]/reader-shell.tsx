"use client";

import { ArrowDownToLine, ChevronLeft } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ReaderChrome = {
  visible: boolean;
  hide: () => void;
  show: () => void;
  toggle: () => void;
};

const ReaderChromeContext = createContext<ReaderChrome | null>(null);

export function useReaderChrome(): ReaderChrome {
  const chrome = useContext(ReaderChromeContext);
  if (!chrome) throw new Error("Reader chrome must be used inside ReaderShell");
  return chrome;
}

/** The viewport-sized frame shared by every browser reader. */
export function ReaderShell({
  title,
  downloadUrl,
  children,
}: {
  title: string;
  downloadUrl: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(true);
  const hide = useCallback(() => setVisible(false), []);
  const show = useCallback(() => setVisible(true), []);
  const toggle = useCallback(() => setVisible((current) => !current), []);
  const chrome = useMemo(
    () => ({ visible, hide, show, toggle }),
    [visible, hide, show, toggle],
  );

  return (
    <ReaderChromeContext.Provider value={chrome}>
      <div className="flex h-dvh flex-col overflow-hidden">
        {visible && (
          <header className="reader-topbar grid shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center border-b border-separator sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4">
            <Link
              href="/"
              aria-label="Back to shelf"
              className="inline-flex size-11 items-center justify-center rounded-full text-sm font-medium text-secondary transition-colors hover:bg-fill hover:text-foreground sm:h-11 sm:w-auto sm:gap-0.5 sm:px-2"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Shelf</span>
            </Link>
            <h1 className="min-w-0 truncate px-2 text-center text-sm font-medium">
              {title}
            </h1>
            <a
              href={downloadUrl}
              download
              aria-label="Download book"
              className="inline-flex size-11 items-center justify-center rounded-full text-sm font-medium text-secondary transition-colors hover:bg-fill hover:text-foreground sm:h-11 sm:w-auto sm:gap-1.5 sm:px-2"
            >
              <ArrowDownToLine aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </header>
        )}

        <div className="flex min-h-0 flex-1">{children}</div>
      </div>
    </ReaderChromeContext.Provider>
  );
}
