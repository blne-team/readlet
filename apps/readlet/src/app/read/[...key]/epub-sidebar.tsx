"use client";

import type { NavItem } from "epubjs";
import { BookOpenText, Highlighter, StickyNote } from "lucide-react";
import type { ReactNode } from "react";
import { ReaderSidebarTabs } from "./reader-sidebar-tabs";

export type EpubPanel = "contents" | "marks" | "notes";

export function EpubSidebar({
  toc,
  panel,
  activeLabel,
  desktopOpen,
  mobileOpen,
  onGo,
  onSelect,
  markContent,
}: {
  toc: { item: NavItem; depth: number }[];
  panel: EpubPanel;
  activeLabel: string;
  desktopOpen: boolean;
  mobileOpen: boolean;
  onGo: (href: string) => void;
  onSelect: (panel: EpubPanel) => void;
  markContent: (mode: "marks" | "notes") => ReactNode;
}) {
  const activeIndex = toc.findIndex(
    ({ item }) => item.label.trim() === activeLabel,
  );
  const title = { contents: "Contents", marks: "Marks", notes: "Notes" }[panel];
  return (
    <aside
      aria-label={title}
      className={`reader-side-panel fixed inset-y-0 left-0 z-40 w-[min(20rem,calc(100vw-3rem))] shrink-0 flex-col border-r border-separator bg-background shadow-page xl:relative xl:w-72 xl:shadow-none ${mobileOpen ? "flex" : "hidden"} ${desktopOpen ? "xl:flex" : "xl:hidden"}`}
    >
      <ReaderSidebarTabs
        items={[
          {
            value: "contents",
            label: "Contents",
            icon: <BookOpenText className="size-4" />,
          },
          {
            value: "marks",
            label: "Marks",
            icon: <Highlighter className="size-4" />,
          },
          {
            value: "notes",
            label: "Notes",
            icon: <StickyNote className="size-4" />,
          },
        ]}
        panel={panel}
        onSelect={onSelect}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {panel === "contents" ? (
          toc.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-tertiary">
              This EPUB has no table of contents.
            </p>
          ) : (
            <nav aria-label="Chapters">
              <ul className="py-2">
                {toc.map(({ item, depth }, index) => {
                  const active = index === activeIndex;
                  return (
                    <li key={`${item.href}-${item.label}`}>
                      <button
                        type="button"
                        onClick={() => onGo(item.href)}
                        aria-current={active ? "location" : undefined}
                        className={`min-h-11 w-full px-3 py-2 text-left text-[13px] leading-snug transition-colors hover:bg-fill ${active ? "font-medium text-accent" : "text-secondary"}`}
                        style={{ paddingLeft: `${0.75 + depth * 0.875}rem` }}
                      >
                        {item.label.trim()}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )
        ) : (
          markContent(panel)
        )}
      </div>
    </aside>
  );
}
