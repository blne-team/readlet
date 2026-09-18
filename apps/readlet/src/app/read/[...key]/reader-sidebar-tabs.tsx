"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ReactNode } from "react";

export function ReaderSidebarToggle({
  open,
  desktopOpen,
  mobileOpen,
  onToggle,
}: {
  open: boolean;
  desktopOpen: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
}) {
  const label = open ? "Close reader panel" : "Open reader panel";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-expanded={open}
      className={`z-50 inline-flex size-11 items-center justify-center rounded-r-lg border border-l-0 border-separator bg-background text-secondary shadow-page transition-[left,background-color,color] hover:bg-fill hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent xl:absolute xl:top-3 ${mobileOpen ? "fixed top-[calc(0.75rem+env(safe-area-inset-top))] left-[min(20rem,calc(100vw-3rem))]" : "absolute top-3 left-0"} ${desktopOpen ? "xl:left-72" : "xl:left-0"}`}
    >
      {open ? (
        <PanelLeftClose aria-hidden="true" className="size-4" />
      ) : (
        <PanelLeftOpen aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

export function ReaderSidebarTabs<Panel extends string>({
  items,
  panel,
  onSelect,
}: {
  items: { value: Panel; label: string; icon: ReactNode }[];
  panel: Panel;
  onSelect: (panel: Panel) => void;
}) {
  return (
    <nav
      aria-label="Reader panels"
      className="flex items-center justify-around gap-1 border-b border-separator px-2 py-1"
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onSelect(item.value)}
          aria-label={item.label}
          title={item.label}
          aria-pressed={panel === item.value}
          className={`inline-flex size-11 items-center justify-center rounded-lg transition-colors ${
            panel === item.value
              ? "bg-accent/10 text-accent"
              : "text-secondary hover:bg-fill hover:text-foreground"
          }`}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}
