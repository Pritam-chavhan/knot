import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { dayLabel, istDayKey } from "@/lib/time";
import { EventCard } from "@/features/events/event-card";
import type { FeedEvent } from "@/features/events/queries";

export const PLAN_FILTERS = [
  { id: "all", label: "All" },
  { id: "going", label: "Going" },
  { id: "interested", label: "Interested" },
  { id: "hosting", label: "Hosting" },
] as const;
export type PlanFilter = (typeof PLAN_FILTERS)[number]["id"];

const EMPTY: Record<PlanFilter, { title: string; body: string; cta: string; href: string }> = {
  all: { title: "Nothing planned yet", body: "Tap Going or Interested on anything in Discover and it lands here, sorted by day.", cta: "Browse events", href: "/discover" },
  going: { title: "You're not going to anything yet", body: "Find something on Discover and tap I'm going.", cta: "Browse events", href: "/discover" },
  interested: { title: "Nothing saved for later", body: "Tap Interested on events you're not sure about yet.", cta: "Browse events", href: "/discover" },
  hosting: { title: "You're not hosting anything", body: "A match, a study session, a chai run. Start one and people can join.", cta: "Host a plan", href: "/host/new" },
};

export function matches(e: FeedEvent, userId: string, f: PlanFilter) {
  const hosting = e.host_id === userId;
  if (f === "hosting") return hosting;
  if (f === "going") return e.my_state === "going" && !hosting;
  if (f === "interested") return e.my_state === "interested";
  return hosting || e.my_state !== null;
}

export function PlansView({ events, userId, filter, now = new Date() }: { events: FeedEvent[]; userId: string; filter: PlanFilter; now?: Date }) {
  const mine = events.filter((e) => matches(e, userId, "all") && e.status !== "cancelled");
  const shown = mine.filter((e) => matches(e, userId, filter));
  const weekEnd = now.getTime() + 7 * 24 * 3600_000;
  const thisWeek = mine.filter((e) => new Date(e.starts_at).getTime() < weekEnd).length;

  const groups = new Map<string, FeedEvent[]>();
  for (const e of shown) {
    const k = istDayKey(new Date(e.starts_at));
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <main className="px-5 pt-6">
      <h1 className="font-display text-[34px] leading-none font-extrabold">My plans</h1>
      <p className="mt-2 text-[15px] text-soft">
        {thisWeek === 0 ? "Nothing in the next 7 days." : thisWeek === 1 ? "1 plan in the next 7 days." : `${thisWeek} plans in the next 7 days.`}
      </p>

      <nav aria-label="Filter plans" className="mt-5">
        <ul className="flex gap-1 rounded-full bg-card p-1">
          {PLAN_FILTERS.map((f) => {
            const n = mine.filter((e) => matches(e, userId, f.id)).length;
            const on = f.id === filter;
            return (
              <li key={f.id} className="flex-1">
                <Link
                  href={f.id === "all" ? "/plans" : `/plans?f=${f.id}`}
                  aria-current={on ? "page" : undefined}
                  scroll={false}
                  className={`flex h-11 items-center justify-center gap-1 rounded-full text-[13px] font-bold transition-colors active:scale-95 ${
                    on ? "bg-ink text-white" : "text-soft hover:bg-paper"
                  }`}
                >
                  {f.label}
                  {n > 0 && <span className={`tabular-nums ${on ? "text-white/70" : "text-muted"}`}>{n}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {shown.length === 0 ? (
        <section className="mt-6 rounded-[30px] border-[1.5px] border-dashed border-line px-6 py-8 text-center">
          <p className="font-display text-[22px] font-extrabold">{EMPTY[filter].title}</p>
          <p className="mx-auto mt-2 max-w-[30ch] text-[15px] text-soft">{EMPTY[filter].body}</p>
          <ButtonLink href={EMPTY[filter].href} className="mt-5">
            {EMPTY[filter].cta}
          </ButtonLink>
        </section>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {[...groups.entries()].map(([key, list]) => (
            <section key={key} aria-label={dayLabel(new Date(list[0].starts_at), now)}>
              <h2 className="font-display mb-2.5 text-[18px] font-extrabold">{dayLabel(new Date(list[0].starts_at), now)}</h2>
              <ul className="flex flex-col gap-3">
                {list.map((e) => (
                  <li key={e.id}>
                    <EventCard e={e} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
