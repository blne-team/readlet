"use client";

import {
  BookOpen,
  ChevronDown,
  HardDrive,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/app/avatar";
import { managerDestinations } from "@/app/management-links";

const icons = {
  "/manage": BookOpen,
  "/users": Users,
  "/resources": HardDrive,
  "/settings": Settings,
};

export function AccountMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function closeOutside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-label={`${name}: open management menu`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-medium transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Avatar name={name} size={28} />
        <span className="hidden max-w-48 truncate sm:inline">{name}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-secondary" />
      </button>
      {open && (
        <nav
          id={menuId}
          aria-label="Management"
          className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border border-separator bg-surface p-1.5 shadow-lg"
        >
          {managerDestinations.map(({ href, label }) => {
            const Icon = icons[href];
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Icon aria-hidden="true" className="size-4 text-secondary" />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
