import Link from "next/link";
import type { Profile } from "@/lib/auth";
import { DayTimeline } from "@/components/art";
import { Avatar, ButtonLink } from "@/components/ui";
import { avatarSrc } from "@/lib/avatar";
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
  now = new Date(),
}: {
  profile: Pick<Profile, "id" | "display_name" | "role" | "avatar_path">;
  events: FeedEvent[];
  category: string | null;
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
  const goingCount = events.filter((e) => e.my_state === "going" && e.status !== "cancelled").length;

  return (
    <main className="px-5 pt-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted">{today}</p>
          <h1 className="font-display mt-0.5 text-[30px] leading-[1.05] font-extrabold">
            {greeting}, {name.split(" ")[0]}
          </h1>
          {goingCount > 0 && (
            <p className="mt-1 text-[14px] text-soft">
              You&apos;re going to {goingCount} {goingCount === 1 ? "thing" : "things"} coming up.
            </p>
          )}
        </div>
        <Link href="/profile" className="shrink-0 rounded-full">
          <span className="sr-only">Your profile</span>
          <Avatar name={name} size={46} src={avatarSrc(profile.id, profile.avatar_path)} />
        </Link>
      </header>

      <div className="mt-5 flex gap-2">
        <ButtonLink href="/host/new" className="h-12 flex-1">
          Host a plan
        </ButtonLink>
        {profile.role === "admin" && (
          <ButtonLink href="/admin" variant="dark" className="h-12">
            Dashboard
          </ButtonLink>
        )}
      </div>

      {events.length === 0 ? (
        <section className="mt-6 overflow-hidden rounded-[30px] bg-thread px-5 pt-6 pb-5 text-white" aria-labelledby="empty-h">
          <h2 id="empty-h" className="font-display max-w-[16ch] text-[26px] leading-[1.05] font-extrabold">
            Nothing on the calendar yet
          </h2>
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
            <nav aria-label="Filter by kind" className="-mx-5 mt-5 overflow-x-auto px-5 pb-1">
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
                <section key={key} className="mt-7" aria-labelledby={`day-${key}`}>
                  <h2 id={`day-${key}`} className="font-display text-[22px] font-extrabold">
                    {dayLabel(d, now)}
                    <span className="ml-2 text-[14px] font-semibold text-muted">{list.length} on</span>
                  </h2>
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
