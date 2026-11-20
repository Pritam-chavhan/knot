import Link from "next/link";
import { TagPill } from "@/components/art";
import { Avatar } from "@/components/ui";
import { dayLabel, formatClock } from "@/lib/time";
import { SOURCE_TAG, categoryLabel } from "@/features/events/categories";
import type { loadEvent } from "@/features/events/queries";
import { HostPanel, JoinRequest, ParticipationButtons, VisibilitySwitch } from "./controls";

const TINT = { official: "bg-thread-tint", community: "bg-river-tint", student_hosted: "bg-marigold-tint" } as const;

export type EventData = NonNullable<Awaited<ReturnType<typeof loadEvent>>>;

export function EventView({ data, userId, isNew }: { data: EventData; userId: string; isNew?: boolean }) {
  const { event: e, isHost, host, counts, mine, goingPeople, visibleGoingTotal, myRequest, requests } = data;
  const user = { id: userId };

  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : null;
  const over = (end ?? new Date(start.getTime() + 3 * 3_600_000)).getTime() < Date.now();
  const cancelled = e.status === "cancelled";
  const full = e.status === "full";
  const hostName = host?.display_name?.split(" ")[0] ?? "The host";
  const hidden = Math.max(0, counts.going - visibleGoingTotal);
  const needsRequest = e.source_type === "student_hosted" && e.join_mode === "request" && !isHost && mine?.state !== "going";

  return (
    <main className="px-5 pt-5 pb-8">
      <Link href="/discover" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[14px] font-bold text-soft hover:text-ink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Discover
      </Link>

      {isNew && (
        <p className="mt-2 rounded-2xl bg-river-tint p-4 text-[15px] font-semibold text-river-deep">
          {isHost ? "Your plan is live. People can find it on Discover now." : "Event added to the feed."}
        </p>
      )}

      <article className={`mt-3 rounded-[30px] p-5 ${TINT[e.source_type]}`}>
        <div className="flex flex-wrap items-center gap-2">
          <TagPill tag={SOURCE_TAG[e.source_type]} onTint />
          <span className="rounded-full bg-card px-2.5 py-1 text-[11px] font-bold text-soft">{categoryLabel(e.category)}</span>
          {cancelled && <span className="rounded-full bg-warn px-2.5 py-1 text-[11px] font-bold text-white">Cancelled</span>}
          {full && !cancelled && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Full</span>}
        </div>
        <h1 className={`font-display mt-3 text-[30px] leading-[1.05] font-extrabold ${cancelled ? "line-through" : ""}`}>{e.title}</h1>
        <dl className="mt-4 flex flex-col gap-2 text-[15px]">
          <div className="flex gap-2">
            <dt className="sr-only">When</dt>
            <dd className="font-semibold">
              {dayLabel(start)}, {formatClock(start)}
              {end && <> to {formatClock(end)}</>}
            </dd>
          </div>
          {e.venue && (
            <div>
              <dt className="sr-only">Where</dt>
              <dd className="text-soft">{e.venue}</dd>
            </div>
          )}
        </dl>
        {e.source_type === "student_hosted" && host ? (
          <div className="mt-4 flex items-center gap-2.5">
            <Avatar name={host.display_name ?? "Host"} size={36} />
            <p className="text-[14px]">
              Hosted by <span className="font-bold">{isHost ? "you" : host.display_name}</span>
            </p>
          </div>
        ) : (
          e.organiser && <p className="mt-3 text-[14px] text-soft">By {e.organiser}</p>
        )}
      </article>

      <section className="mt-4 grid grid-cols-2 gap-2" aria-label="How many are coming">
        <div className="rounded-[22px] bg-marigold p-4">
          <p className="font-display text-[30px] leading-none font-extrabold tabular-nums">{counts.going}</p>
          <p className="mt-1 text-[13px] font-semibold">going</p>
        </div>
        <div className="rounded-[22px] bg-card p-4">
          <p className="font-display text-[30px] leading-none font-extrabold tabular-nums">
            {e.capacity && e.source_type === "student_hosted" ? `${Math.max(0, e.capacity - counts.going)}` : counts.interested}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-soft">
            {e.capacity && e.source_type === "student_hosted" ? (e.capacity - counts.going === 1 ? "spot left" : "spots left") : "interested"}
          </p>
        </div>
      </section>

      <div className="mt-4">
        {isHost ? (
          mine && <VisibilitySwitch eventId={e.id} visible={mine.is_visible} />
        ) : cancelled ? (
          <p className="rounded-[24px] bg-paper p-4 text-[15px] text-soft">This was cancelled. Find something else on Discover.</p>
        ) : over ? (
          <p className="rounded-[24px] bg-paper p-4 text-[15px] text-soft">This has already happened.</p>
        ) : needsRequest ? (
          <JoinRequest eventId={e.id} hostName={hostName} status={myRequest} disabled={full} />
        ) : (
          <>
            <ParticipationButtons eventId={e.id} mine={mine?.state ?? null} full={full} disabled={false} />
            {mine?.state === "going" && <VisibilitySwitch eventId={e.id} visible={mine.is_visible} />}
          </>
        )}
      </div>

      {isHost && <div className="mt-4"><HostPanel eventId={e.id} requests={requests} canCancel={!cancelled && !over} /></div>}

      {(e.description || e.registration_url) && (
        <section className="mt-4 rounded-[28px] bg-card p-5" aria-labelledby="about-h">
          <h2 id="about-h" className="font-display text-[20px] font-extrabold">
            About
          </h2>
          {e.description && <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-soft">{e.description}</p>}
          {e.registration_url && (
            <a
              href={e.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-line text-[15px] font-bold hover:border-ink/30"
            >
              Register on the organiser&apos;s page
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </section>
      )}

      <section className="mt-4 rounded-[28px] bg-card p-5" aria-labelledby="who-h">
        <h2 id="who-h" className="font-display text-[20px] font-extrabold">
          Who&apos;s going
        </h2>
        {goingPeople.length === 0 ? (
          <p className="mt-2 text-[15px] text-soft">
            {hidden > 0 ? "Everyone going has kept their name hidden." : "No one yet. Be the first, and others will see you're in."}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {goingPeople.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={p.display_name ?? "Student"} size={40} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{p.id === user.id ? "You" : p.display_name}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {[p.programme, p.batch_year && `Class of ${p.batch_year}`].filter(Boolean).join(", ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && goingPeople.length > 0 && (
          <p className="mt-2 text-[13px] text-muted">
            + {hidden} more going with their name hidden
          </p>
        )}
      </section>
    </main>
  );
}
