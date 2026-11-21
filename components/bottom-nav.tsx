"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; match: (p: string) => boolean; icon: React.ReactNode };

const TABS: Tab[] = [
  {
    href: "/discover",
    label: "Discover",
    match: (p) => p.startsWith("/discover") || p.startsWith("/events") || p.startsWith("/map"),
    icon: <><circle cx="12" cy="12" r="8.5" /><path d="M15.2 8.8l-1.9 4.5-4.5 1.9 1.9-4.5z" /></>,
  },
  {
    href: "/plans",
    label: "Plans",
    match: (p) => p.startsWith("/plans"),
    icon: <><rect x="3.5" y="5" width="17" height="15.5" rx="4" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4M8 14.5l2 2 4-4" /></>,
  },
  {
    href: "/chats",
    label: "Chats",
    match: (p) => p.startsWith("/chats") || p.startsWith("/activity"),
    icon: <path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4 19.5l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z" />,
  },
  {
    href: "/profile",
    label: "You",
    match: (p) => p.startsWith("/profile") || p.startsWith("/admin"),
    icon: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c.8-3.9 3.8-6.2 7.5-6.2s6.7 2.3 7.5 6.2" /></>,
  },
];

// Slots left to right; the Host button sits in the middle.
const SLOTS = [TABS[0], TABS[1], null, TABS[2], TABS[3]] as const;

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function BottomNav({ chatsCount = 0 }: { chatsCount?: number }) {
  const path = usePathname();
  // A chat has its own message box at the bottom instead.
  if (/^\/chats\/[^/]+/.test(path)) return null;
  return <BottomNavView path={path} chatsCount={chatsCount} />;
}

export function BottomNavView({ path, chatsCount = 0 }: { path: string; chatsCount?: number }) {
  const hosting = path.startsWith("/host");
  const active = SLOTS.findIndex((t) => t?.match(path));

  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
    >
      <div className="pointer-events-auto relative w-full max-w-[420px] rounded-[30px] bg-ink px-1.5 pt-1.5 pb-1.5 shadow-[0_18px_44px_-14px_rgba(23,20,43,0.6)]">
        {/* Highlight that slides to the active tab. */}
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 left-1.5 rounded-[24px] bg-white/[0.11] transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          style={{
            width: "calc((100% - 12px) / 5)",
            transform: `translateX(${Math.max(active, 0) * 100}%)`,
            opacity: active < 0 ? 0 : 1,
          }}
        />
        <ul className="relative grid grid-cols-5">
          {SLOTS.map((t, i) =>
            t === null ? (
              <li key="host" className="flex justify-center">
                <Link
                  href="/host/new"
                  aria-current={hosting ? "page" : undefined}
                  className="group -mt-6 flex flex-col items-center gap-1 rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-marigold"
                >
                  <span
                    className={`flex h-[58px] w-[58px] items-center justify-center rounded-full bg-marigold text-ink shadow-[0_10px_24px_-8px_rgba(255,176,32,0.85)] ring-[5px] ring-ink transition-transform duration-200 group-active:scale-90 motion-reduce:transition-none ${
                      hosting ? "rotate-45" : "group-hover:-translate-y-0.5"
                    }`}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  <span className="text-[11.5px] leading-none font-bold text-white">Host</span>
                </Link>
              </li>
            ) : (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={i === active ? "page" : undefined}
                  className={`group relative flex h-[56px] flex-col items-center justify-center gap-1 rounded-[24px] transition-colors focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-marigold ${
                    i === active ? "text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  <span className="relative transition-transform duration-200 group-active:scale-90 motion-reduce:transition-none">
                    <Icon>{t.icon}</Icon>
                    {t.href === "/chats" && chatsCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose px-1 text-[11px] leading-none font-extrabold text-ink ring-2 ring-ink">
                        {chatsCount > 9 ? "9+" : chatsCount}
                      </span>
                    )}
                  </span>
                  <span className="text-[11.5px] leading-none font-bold">{t.label}</span>
                  {t.href === "/chats" && chatsCount > 0 && (
                    <span className="sr-only">, {chatsCount === 1 ? "1 new" : `${chatsCount} new`}</span>
                  )}
                </Link>
              </li>
            ),
          )}
        </ul>
      </div>
    </nav>
  );
}
