import Link from "next/link";
import { InstallPrompt } from "@/features/notifications/install-prompt";
import type { Profile } from "@/lib/auth";
import { DayTimeline } from "@/components/art";
import { Avatar } from "@/components/ui";
import { WhosAroundCard } from "./whos-around-card";
import { avatarSrc } from "@/lib/avatar";
import { LiveUpdates } from "@/components/live-updates";
import { dayLabel, istDayKey } from "@/lib/time";
import { CATEGORIES } from "@/features/events/categories";
import { EventCard } from "@/features/events/event-card";
import type { FeedEvent } from "@/features/events/queries";

function groupByDay(events: FeedEvent[]) {
  const groups = new Map<string, FeedEvent[]>();
  for (const e of events) {
    const k = istDayKey(new Date(e.starts_at));
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.entries()];
}

export function DiscoverView({
  profile,
  events,
  category,
  live = 0,
  now = new Date(),
}: {
  profile: Pick<Profile, "id" | "display_name" | "role" | "avatar_path">;
  events: FeedEvent[];
  category: string | null;
  // People sharing their spot with everyone right now.
  live?: number;
  now?: Date;
}) {
  const name = profile.display_name ?? "there";
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  const greeting = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(now);

  const present = new Set(events.map((e) => e.category));
  const chips = CATEGORIES.filter((c) => present.has(c.id));
  const shown = category ? events.filter((e) => e.category === category) : events;
  const days = groupByDay(shown);

  return (
    <main className="px-5 pt-6">
      <LiveUpdates knownIds={events.map((e) => e.id)} />
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted">{today}</p>
          <h1 className="font-display mt-0.5 text-[27px] leading-[1.05] font-extrabold">
            {greeting}, {name.split(" ")[0]}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {profile.role === "admin" && (
            <Link href="/admin" className="flex min-h-11 items-center rounded-full bg-ink px-3.5 text-[13px] font-bold text-white">
              Dashboard
            </Link>
          )}
          <Link href="/profile" className="rounded-full">
            <span className="sr-only">Your profile</span>
            <Avatar name={name} size={46} src={avatarSrc(profile.id, profile.avatar_path)} />
          </Link>
        </div>
      </header>

      <WhosAroundCard live={live} />
      <InstallPrompt />

      <h2 className="font-display mt-7 text-[24px] font-extrabold">What&apos;s on</h2>

      {events.length === 0 ? (
        <section className="mt-3 overflow-hidden rounded-[30px] bg-thread px-5 pt-6 pb-5 text-white" aria-labelledby="empty-h">
          <h3 id="empty-h" className="font-display max-w-[16ch] text-[26px] leading-[1.05] font-extrabold">
            Nothing on the calendar yet
          </h3>
          <p className="mt-2 max-w-[32ch] text-[15px] leading-relaxed text-white/85">
            Be the first: start a plan and people can join you. Here&apos;s what the feed will look like.
          </p>
          <div className="mt-5 rounded-[24px] bg-thread-tint p-3 text-ink">
            <p className="mb-2 px-1 text-[12px] font-bold text-thread-deep">Example</p>
            <DayTimeline compact />
          </div>
        </section>
      ) : (
        <>
          {chips.length > 1 && (
            <nav aria-label="Filter by kind" className="-mx-5 mt-3 overflow-x-auto px-5 pb-1">
              <ul className="flex gap-2">
                {[{ id: null, label: "All" }, ...chips].map((c) => {
                  const active = category === c.id;
                  return (
                    <li key={c.label}>
                      <Link
                        href={c.id ? `/discover?c=${c.id}` : "/discover"}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap ${
                          active ? "bg-ink text-white" : "bg-card text-soft hover:bg-thread-tint"
                        }`}
                      >
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          {days.length === 0 ? (
            <p className="mt-8 rounded-[24px] bg-card p-5 text-[15px] text-soft">
              Nothing in this category coming up.{" "}
              <Link href="/discover" className="font-bold text-thread underline underline-offset-2">
                See everything
              </Link>
            </p>
          ) : (
            days.map(([key, list]) => {
              const d = new Date(list[0].starts_at);
              return (
                <section key={key} className="mt-6" aria-labelledby={`day-${key}`}>
                  <h3 id={`day-${key}`} className="text-[15px] font-bold text-soft">
                    {dayLabel(d, now)}
                    <span className="ml-1.5 font-semibold text-muted">· {list.length === 1 ? "1 event" : `${list.length} events`}</span>
                  </h3>
                  <ul className="mt-3 flex flex-col gap-3">
                    {list.map((e) => (
                      <li key={e.id}>
                        <EventCard e={e} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </>
      )}

      <Link href="/welcome" className="mt-8 mb-6 flex min-h-14 items-center justify-between rounded-[24px] bg-card px-5 py-4 hover:bg-white/70">
        <span>
          <span className="block font-bold">How KNOT works</span>
          <span className="text-[13px] text-muted">Take the one-minute tour again</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </main>
  );
}
