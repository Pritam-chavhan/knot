"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/discover",
    label: "Discover",
    icon: <><rect x="3.5" y="5" width="17" height="15.5" rx="4" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4" /></>,
  },
  {
    href: "/profile",
    label: "You",
    icon: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c.8-3.9 3.8-6.2 7.5-6.2s6.7 2.3 7.5 6.2" /></>,
  },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-5"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
    >
      <ul className="flex w-full max-w-[280px] gap-1 rounded-full bg-ink p-1.5 shadow-[0_16px_40px_-12px_rgba(23,20,43,0.55)]">
        {ITEMS.map((it) => {
          const active = path.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 items-center justify-center gap-2 rounded-full text-[14px] font-bold transition-colors ${
                  active ? "bg-white text-ink" : "text-white/70 hover:text-white"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {it.icon}
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
