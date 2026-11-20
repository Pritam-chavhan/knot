import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { RequestRow } from "@/features/events/controls";
import { dayLabel, formatClock, startsIn, whenLabel } from "@/lib/time";
import type { loadActivity, ReviewItem } from "./queries";

type Data = Awaited<ReturnType<typeof loadActivity>>;

const STATUS = {
  pending: { label: "Waiting for the host", className: "bg-paper text-soft" },
  accepted: { label: "You're in", className: "bg-river-tint text-river-deep" },
  declined: { label: "Not this time", className: "bg-paper text-muted" },
} as const;

function byEvent(items: ReviewItem[]) {
  const groups = new Map<string, ReviewItem[]>();
  for (const r of items) groups.set(r.event.id, [...(groups.get(r.event.id) ?? []), r]);
  return [...groups.values()];
}

export function ActivityView({ data, now = new Date() }: { data: Data; now?: Date }) {
  const { review, mine, soon } = data;
  const empty = review.length === 0 && mine.length === 0 && soon.length === 0;

  return (
    <main className="px-5 pt-6">
      <h1 className="font-display text-[34px] leading-none font-extrabold">Activity</h1>
      <p className="mt-2 text-[15px] text-soft">Requests to review, replies to yours and what&apos;s coming up.</p>

      {soon.length > 0 && (
        <section className="mt-6" aria-labelledby="soon-h">
          <h2 id="soon-h" className="font-display mb-3 text-[20px] font-extrabold">
            Starting soon
          </h2>
          <ul className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {soon.map(({ event: e }) => (
              <li key={e.id} className="w-[78%] max-w-[300px] shrink-0 snap-start">
                <Link href={`/events/${e.id}`} className="block h-full rounded-[24px] bg-thread p-4 text-white transition-transform active:scale-[0.98]">
                  <p className="font-display text-[15px] font-bold">
                    {formatClock(new Date(e.starts_at))} <span className="font-normal text-white/80">· {startsIn(new Date(e.starts_at), now)}</span>
                  </p>
                  <p className="font-display mt-1 text-[19px] leading-tight font-bold">{e.title}</p>
                  {e.venue && <p className="mt-1 truncate text-[14px] text-white/80">{e.venue}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.length > 0 && (
        <section className="mt-6" aria-labelledby="review-h">
          <h2 id="review-h" className="font-display mb-3 flex items-center gap-2 text-[20px] font-extrabold">
            Waiting for you
            <span className="rounded-full bg-rose px-2.5 py-0.5 text-[13px] font-bold text-ink">{review.length}</span>
          </h2>
          <div className="flex flex-col gap-3">
            {byEvent(review).map((group) => {
              const e = group[0].event;
              return (
                <article key={e.id} className="rounded-[28px] bg-card p-4">
                  <Link href={`/events/${e.id}`} className="block rounded-xl px-1 underline-offset-4 hover:underline">
                    <h3 className="font-display text-[17px] leading-tight font-bold">{e.title}</h3>
                    <p className="text-[13px] text-muted">{whenLabel(new Date(e.starts_at), now)}</p>
                  </Link>
                  <ul className="mt-3 flex flex-col gap-2">
                    {group.map((r) => (
                      <RequestRow key={r.id} eventId={e.id} id={r.id} note={r.note} person={r.person} />
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {mine.length > 0 && (
        <section className="mt-6" aria-labelledby="mine-h">
          <h2 id="mine-h" className="font-display mb-3 text-[20px] font-extrabold">
            Your requests
          </h2>
          <ul className="flex flex-col gap-2">
            {mine.map((r) => (
              <li key={r.id}>
                <Link href={`/events/${r.event.id}`} className="flex items-center gap-3 rounded-[22px] bg-card p-4 transition-transform active:scale-[0.99]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{r.event.title}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {dayLabel(new Date(r.event.starts_at), now)}, {formatClock(new Date(r.event.starts_at))}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold ${STATUS[r.status].className}`}>{STATUS[r.status].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {empty && (
        <section className="mt-8 rounded-[30px] border-[1.5px] border-dashed border-line px-6 py-8 text-center">
          <p className="font-display text-[22px] font-extrabold">All quiet for now</p>
          <p className="mx-auto mt-2 max-w-[30ch] text-[15px] text-soft">
            When someone asks to join your plan, or a host replies to you, it shows up here.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <ButtonLink href="/host/new">Host a plan</ButtonLink>
            <ButtonLink href="/discover" variant="ghost">
              Find something to join
            </ButtonLink>
          </div>
        </section>
      )}
    </main>
  );
}
