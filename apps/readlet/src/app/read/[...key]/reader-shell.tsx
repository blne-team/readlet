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
import { createPortal } from "react-dom";

type ReaderChrome = {
  visible: boolean;
  hide: () => void;
  show: () => void;
  toggle: () => void;
  toolbarTarget: HTMLDivElement | null;
  actionsTarget: HTMLDivElement | null;
  progressTarget: HTMLDivElement | null;
};

const ReaderChromeContext = createContext<ReaderChrome | null>(null);

export function useReaderChrome(): ReaderChrome {
  const chrome = useContext(ReaderChromeContext);
  if (!chrome) throw new Error("Reader chrome must be used inside ReaderShell");
  return chrome;
}

/** Places desktop reader actions in the shared header's single row. */
export function ReaderHeaderTools({ children }: { children: ReactNode }) {
  const { toolbarTarget } = useReaderChrome();
  return toolbarTarget ? createPortal(children, toolbarTarget) : null;
}

/** Places less frequently used controls at the right edge of the header. */
export function ReaderHeaderActions({ children }: { children: ReactNode }) {
  const { actionsTarget } = useReaderChrome();
  return actionsTarget ? createPortal(children, actionsTarget) : null;
}

export function ReaderHeaderProgress({ children }: { children: ReactNode }) {
  const { progressTarget } = useReaderChrome();
  return progressTarget ? createPortal(children, progressTarget) : null;
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
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const [progressTarget, setProgressTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const hide = useCallback(() => setVisible(false), []);
  const show = useCallback(() => setVisible(true), []);
  const toggle = useCallback(() => setVisible((current) => !current), []);
  const chrome = useMemo(
    () => ({
      visible,
      hide,
      show,
      toggle,
      toolbarTarget,
      actionsTarget,
      progressTarget,
    }),
    [visible, hide, show, toggle, toolbarTarget, actionsTarget, progressTarget],
  );

  return (
    <ReaderChromeContext.Provider value={chrome}>
      <div className="flex h-dvh min-w-0 flex-col overflow-hidden">
        {visible && (
          <header className="reader-topbar relative shrink-0 border-b border-separator bg-background">
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-4">
              <div className="contents xl:flex xl:min-w-0 xl:items-center xl:gap-2">
                <Link
                  href="/"
                  aria-label="Back to shelf"
                  className="col-start-1 row-start-1 inline-flex size-11 items-center justify-center rounded-lg text-sm font-medium text-secondary transition-colors hover:bg-fill hover:text-foreground xl:col-auto xl:row-auto xl:w-auto xl:gap-0.5 xl:px-2"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  <span className="hidden xl:inline">Shelf</span>
                </Link>
                <span
                  className="hidden h-5 w-px shrink-0 bg-separator xl:block"
                  aria-hidden="true"
                />
                <h1 className="col-start-2 row-start-1 min-w-0 truncate px-2 text-center text-sm font-medium xl:col-auto xl:row-auto xl:px-0 xl:text-left">
                  {title}
                </h1>
              </div>
              <div
                ref={setToolbarTarget}
                className="hidden items-center justify-center xl:flex"
              />
              <div className="contents xl:flex xl:min-w-0 xl:items-center xl:justify-end xl:gap-2">
                <div
                  ref={setActionsTarget}
                  className="hidden min-w-0 items-center xl:flex"
                />
                <a
                  href={downloadUrl}
                  download
                  aria-label="Download book"
                  className="col-start-3 row-start-1 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-secondary transition-colors hover:bg-fill hover:text-foreground xl:col-auto xl:row-auto xl:w-auto xl:gap-1.5 xl:px-2"
                >
                  <ArrowDownToLine aria-hidden="true" className="size-4" />
                  <span className="hidden xl:inline">Download</span>
                </a>
              </div>
            </div>
            <div
              ref={setProgressTarget}
              className="reader-header-progress absolute inset-x-0 bottom-0 hidden xl:block"
            />
          </header>
        )}

        <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
      </div>
    </ReaderChromeContext.Provider>
  );
}
