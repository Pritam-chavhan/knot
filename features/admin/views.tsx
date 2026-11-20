import Link from "next/link";
import { TagPill } from "@/components/art";
import { Avatar, ButtonLink } from "@/components/ui";
import { SOURCE_TAG } from "@/features/events/categories";
import { ActivityChart } from "./activity-chart";
import { EventControls, PersonControls } from "./controls";
import { ago, dateShort } from "./format";
import type { AdminEventRow, LogRow, PersonRow, Stats } from "./queries";

function Tile({ value, label, sub, accent = false }: { value: number | string; label: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-[22px] p-4 ${accent ? "bg-thread text-white" : "bg-card"}`}>
      <p className="font-display text-[30px] leading-none font-extrabold tabular-nums">{value}</p>
      <p className={`mt-1.5 text-[13px] font-semibold ${accent ? "text-white" : "text-ink"}`}>{label}</p>
      {sub && <p className={`text-[12px] ${accent ? "text-white/80" : "text-muted"}`}>{sub}</p>}
    </div>
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");

export function OverviewView({ s }: { s: Stats }) {
  return (
    <>
      <section aria-labelledby="students-h" className="mt-6">
        <h2 id="students-h" className="font-display text-[20px] font-extrabold">Students</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile accent value={s.students} label="Signed up" sub={`${s.signups_today} today · ${s.signups_7d} this week`} />
          <Tile value={pct(s.onboarded, s.students)} label="Finished their profile" sub={`${s.onboarded} of ${s.students}`} />
          <Tile value={s.active_today} label="Active today" />
          <Tile value={s.active_7d} label="Active this week" sub={`${s.active_30d} this month`} />
        </div>
      </section>

      <section aria-labelledby="chart-h" className="mt-6 rounded-[28px] bg-card p-5">
        <h2 id="chart-h" className="font-display text-[20px] font-extrabold">Last 30 days</h2>
        <div className="mt-3">
          <ActivityChart data={s.daily} />
        </div>
      </section>

      <section aria-labelledby="usage-h" className="mt-6">
        <h2 id="usage-h" className="font-display text-[20px] font-extrabold">What they&apos;re doing</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile value={s.events_upcoming} label="Upcoming events" />
          <Tile value={s.plans_hosted} label="Plans hosted by students" />
          <Tile value={s.going_taps} label="Going taps" sub={`${s.interested_taps} interested`} />
          <Tile value={s.join_accepted} label="Let in to plans" sub={`of ${s.join_requests} asked`} />
        </div>
      </section>

      <section aria-labelledby="safety-h" className="mt-6 mb-6">
        <h2 id="safety-h" className="font-display text-[20px] font-extrabold">Safety</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile value={s.open_reports} label="Open reports" sub="Report handling arrives on Day 3" />
          <Tile value={s.suspended} label="Suspended accounts" />
        </div>
      </section>
    </>
  );
}

export function PeopleView({ rows, q, page, hasMore, meId, meIsFounder }: { rows: PersonRow[]; q: string | null; page: number; hasMore: boolean; meId: string; meIsFounder: boolean }) {
  return (
    <section aria-labelledby="people-h" className="mt-6 mb-6">
      <h2 id="people-h" className="sr-only">People</h2>
      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">Search by name or email</label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Search name or email"
          className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-card px-4 text-base focus:border-thread focus:outline-none"
        />
        <button type="submit" className="h-12 rounded-full bg-ink px-5 text-[14px] font-bold text-white">Search</button>
      </form>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-[24px] bg-card p-5 text-[15px] text-soft">{q ? `No one matches "${q}".` : "No one has signed up yet."}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((p) => (
            <li key={p.id} className={`rounded-[22px] p-4 ${p.status === "suspended" ? "border-[1.5px] border-dashed border-warn/40 bg-paper" : "bg-card"}`}>
              <div className="flex items-start gap-3">
                <Avatar name={p.display_name ?? p.email} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-bold">
                    <span className="truncate">{p.display_name ?? "No name yet"}</span>
                    {p.is_founder ? (
                      <span className="rounded-full bg-thread px-2 py-0.5 text-[11px] font-bold text-white">Founder</span>
                    ) : (
                      p.role === "admin" && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">Admin</span>
                    )}
                    {p.status === "suspended" && <span className="rounded-full bg-warn px-2 py-0.5 text-[11px] font-bold text-white">Suspended</span>}
                    {!p.onboarded && <span className="rounded-full bg-marigold-tint px-2 py-0.5 text-[11px] font-bold text-[#6e4300]">Profile not finished</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted">{p.email}</p>
                  <p className="mt-1 text-[13px] text-soft">
                    {[p.programme, p.batch_year && `Class of ${p.batch_year}`].filter(Boolean).join(", ") || "No programme yet"}
                  </p>
                  <p className="text-[12px] text-muted">
                    Joined {ago(p.created_at)} · Last active {ago(p.last_seen_at)}
                  </p>
                </div>
              </div>
              {p.id === meId ? (
                <p className="mt-2 text-[13px] text-muted">This is you.</p>
              ) : p.is_founder || (p.role === "admin" && !meIsFounder) ? (
                <p className="mt-2 text-[13px] text-muted">Only the founder can change another admin.</p>
              ) : (
                <PersonControls id={p.id} status={p.status} role={p.role} self={false} />
              )}
            </li>
          ))}
        </ul>
      )}
      {(page > 0 || hasMore) && (
        <nav aria-label="More people" className="mt-4 flex justify-between">
          {page > 0 ? (
            <Link href={`/admin/people?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`} className="flex min-h-11 items-center font-bold text-thread">
              Newer
            </Link>
          ) : <span />}
          {hasMore && (
            <Link href={`/admin/people?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`} className="flex min-h-11 items-center font-bold text-thread">
              Older
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}

export function EventsView({ rows }: { rows: AdminEventRow[] }) {
  return (
    <section aria-labelledby="events-h" className="mt-6 mb-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="events-h" className="font-display text-[20px] font-extrabold">Events</h2>
        <ButtonLink href="/admin/events/new" className="h-11 min-h-11 px-5 text-[14px]">Add event</ButtonLink>
      </div>
      <p className="mt-1 text-[13px] text-muted">Everything from the last 2 weeks and coming up, including hidden and cancelled.</p>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-[24px] bg-card p-5 text-[15px] text-soft">No events yet. Add one from your inbox to get the feed going.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((e) => (
            <li key={e.id} className="rounded-[22px] bg-card p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <TagPill tag={SOURCE_TAG[e.source_type]} />
                {e.review_status === "rejected" && <span className="rounded-full bg-warn px-2 py-0.5 text-[11px] font-bold text-white">Hidden</span>}
                {e.status === "cancelled" && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">Cancelled</span>}
                {e.status === "full" && <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-bold text-soft">Full</span>}
              </div>
              <Link href={`/events/${e.id}`} className="font-display mt-2 block text-[17px] leading-tight font-bold hover:underline">
                {e.title}
              </Link>
              <p className="mt-1 text-[13px] text-muted">
                {dateShort(e.starts_at)}
                {e.venue && ` · ${e.venue}`}
                {e.host_name && ` · hosted by ${e.host_name}`}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-soft">
                {e.going} going · {e.interested} interested
              </p>
              <EventControls id={e.id} status={e.status} review={e.review_status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ACTION_LABEL: Record<string, string> = {
  suspend_user: "suspended",
  restore: "restored",
  make_admin: "made admin",
  remove_admin: "removed admin from",
  cancel_event: "cancelled",
  hide_event: "hid",
  restore_event: "restored",
  dismiss: "dismissed a report on",
  warn: "warned",
};

export function LogView({ rows }: { rows: LogRow[] }) {
  return (
    <section aria-labelledby="log-h" className="mt-6 mb-6">
      <h2 id="log-h" className="font-display text-[20px] font-extrabold">Admin log</h2>
      <p className="mt-1 text-[13px] text-muted">Every admin action, newest first. It can&apos;t be edited.</p>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-[24px] bg-card p-5 text-[15px] text-soft">No admin actions yet.</p>
      ) : (
        <ol className="mt-4 divide-y divide-line rounded-[24px] bg-card">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-[14px]">
              <p>
                <span className="font-bold">{r.admin_name ?? "An admin"}</span> {ACTION_LABEL[r.action] ?? r.action}{" "}
                <span className="font-bold">{r.target_label}</span>
              </p>
              {r.note && <p className="mt-0.5 text-[13px] text-soft">&ldquo;{r.note}&rdquo;</p>}
              <p className="mt-0.5 text-[12px] text-muted">{dateShort(r.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
