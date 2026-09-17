import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AccountMenu } from "@/app/account-menu";
import { managerDestinations } from "@/app/management-links";

export function ManagementHeader({
  name,
  current,
}: {
  name: string;
  current: (typeof managerDestinations)[number]["href"];
}) {
  return (
    <header>
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-0.5 rounded-full pr-3 text-sm font-medium text-secondary transition-colors hover:bg-fill hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Shelf
        </Link>
        <AccountMenu name={name} />
      </div>
      <nav
        aria-label="Management sections"
        className="mt-6 flex gap-1 overflow-x-auto border-b border-separator"
      >
        {managerDestinations.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={current === href ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              current === href
                ? "border-accent text-foreground"
                : "border-transparent text-secondary hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
