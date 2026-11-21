"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/signups", label: "Sign-ups" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/log", label: "Log" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard sections" className="-mx-5 overflow-x-auto px-5">
      <ul className="flex gap-1 rounded-full bg-card p-1">
        {TABS.map((t) => {
          const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href) && path !== "/admin/events/new" && !(t.href === "/admin/events" && path.endsWith("/edit"));
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center justify-center rounded-full px-3 text-[14px] font-bold whitespace-nowrap ${active ? "bg-ink text-white" : "text-soft hover:text-ink"}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
