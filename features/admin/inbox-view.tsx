import Link from "next/link";
import { OfficialSenderButton, ProposalControls, ReviewControls } from "./controls";
import { ago } from "./format";
import { formatClock, dayLabel, whenLabel } from "@/lib/time";
import { senderAddress } from "@/features/ingest/decide";
import type { InboxRow, InboxStats, Proposal } from "./queries";

const OUTCOME: Record<string, { label: string; className: string }> = {
  published: { label: "Published", className: "bg-river-tint text-river-deep" },
  updated: { label: "Updated", className: "bg-thread-tint text-thread-deep" },
  cancelled: { label: "Cancelled", className: "bg-paper text-soft" },
  needs_review: { label: "Reviewed", className: "bg-paper text-soft" },
  error: { label: "Failed", className: "bg-warn/10 text-warn" },
};

function senderName(from: string | null) {
  if (!from) return "Unknown sender";
  const name = from.match(/^"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return name || from.replace(/[<>]/g, "");
}

function SenderLine({ r, now }: { r: InboxRow; now: Date }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-muted">
      <span>{senderName(r.from_address)}</span>
      {r.sender_official ? (
        <span className="rounded-full bg-thread-tint px-2 py-0.5 text-thread-deep">Official sender</span>
      ) : r.sender_verified ? (
        <span className="rounded-full bg-river-tint px-2 py-0.5 text-river-deep">Verified IITGN</span>
      ) : (
        <span className="rounded-full bg-warn/10 px-2 py-0.5 text-warn">Not verified</span>
      )}
      <span>{ago(r.received_at, now.getTime())}</span>
    </p>
  );
}

const when = (iso: string, now: Date) => `${dayLabel(new Date(iso), now)}, ${formatClock(new Date(iso))}`;

function ChangeList({ p, now }: { p: Proposal; now: Date }) {
  if (p.kind === "cancel") return <p className="mt-2 rounded-xl bg-warn/10 px-3 py-2 text-[14px] font-semibold text-warn">The mail says this event is cancelled.</p>;
  return (
    <dl className="mt-2 flex flex-col gap-1.5 rounded-xl bg-paper px-3 py-2.5 text-[14px]">
      {p.after.starts_at && (
        <div>
          <dt className="text-[12px] font-semibold text-muted">Time</dt>
          <dd>
            <s className="text-muted">{p.before.starts_at ? when(p.before.starts_at, now) : "Not set"}</s> → <strong>{when(p.after.starts_at, now)}</strong>
          </dd>
        </div>
      )}
      {p.after.venue && (
        <div>
          <dt className="text-[12px] font-semibold text-muted">Venue</dt>
          <dd>
            <s className="text-muted">{p.before.venue ?? "Not set"}</s> → <strong>{p.after.venue}</strong>
          </dd>
        </div>
      )}
    </dl>
  );
}

export function InboxView({ rows, stats, saved, now = new Date() }: { rows: InboxRow[]; stats: InboxStats | null; saved?: boolean; now?: Date }) {
  const upcoming = (r: InboxRow) => !!r.event_starts_at && new Date(r.event_starts_at) > now;
  const newEvents = rows.filter((r) => r.outcome === "needs_review" && !r.proposal && r.event_review_status === "pending" && upcoming(r));
  const changes = rows.filter((r) => r.outcome === "needs_review" && r.proposal && !r.proposal.resolved && upcoming(r) && r.event_status !== "cancelled");
  const queued = new Set([...newEvents, ...changes].map((r) => r.id));
  const recent = rows.filter((r) => !queued.has(r.id)).slice(0, 30);
  const toReview = newEvents.length + changes.length;
  const live = stats?.last_mail_at && now.getTime() - new Date(stats.last_mail_at).getTime() < 26 * 3600_000;

  return (
    <div className="mt-6 mb-8 flex flex-col gap-6">
      {saved && (
        <p role="status" className="rounded-2xl bg-river-tint px-4 py-3 text-[14px] font-semibold text-river-deep">
          Saved and published.
        </p>
      )}

      <section aria-labelledby="feed-h" className="rounded-[28px] bg-ink p-5 text-white">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${stats?.connected ? (live ? "animate-pulse bg-river motion-reduce:animate-none" : "bg-marigold") : "bg-white/40"}`} />
          <h2 id="feed-h" className="font-display text-[18px] font-extrabold">
            {!stats?.connected ? "Email feed not connected" : live ? "Email feed is live" : "Connected, waiting for mail"}
          </h2>
        </div>
        <p className="mt-1 text-[14px] text-white/75">
          {!stats?.connected
            ? "Once your Gmail script is set up, campus event mails turn into events here within a minute."
            : stats.last_mail_at
              ? `Last campus mail arrived ${ago(stats.last_mail_at, now.getTime()).toLowerCase()}.`
              : "No campus mail has arrived yet."}
        </p>
        {stats?.connected && (
          <>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                ["Mails", stats.mails_7d],
                ["Published", stats.published_7d],
                ["Updated", stats.updated_7d],
                ["Skipped", stats.skipped_7d],
              ].map(([label, n]) => (
                <div key={label} className="rounded-2xl bg-white/10 px-1 py-2.5">
                  <dd className="font-display text-[22px] leading-none font-extrabold tabular-nums">{n}</dd>
                  <dt className="mt-1 text-[12px] text-white/70">{label}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-white/60">
              Last 7 days. Skipped mails aren&apos;t about events and aren&apos;t kept.
              {stats.failed_7d > 0 && ` ${stats.failed_7d} couldn't be read; they're listed below.`}
              {stats.official_senders === 0
                ? " No official senders yet, so mail events show as club events until you mark a sender as official."
                : ` ${stats.official_senders} official ${stats.official_senders === 1 ? "sender" : "senders"}.`}
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="review-h">
        <h2 id="review-h" className="font-display mb-3 flex items-center gap-2 text-[20px] font-extrabold">
          Needs your review
          {toReview > 0 && <span className="rounded-full bg-marigold px-2.5 py-0.5 text-[13px] font-bold text-ink">{toReview}</span>}
        </h2>
        {toReview === 0 ? (
          <p className="rounded-[24px] border-[1.5px] border-dashed border-line p-5 text-center text-[14px] text-soft">
            Nothing to check. Clear events from verified senders go live on their own.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {changes.map((r) => (
              <li key={r.id} className="rounded-[28px] bg-card p-4">
                <SenderLine r={r} now={now} />
                <p className="mt-1 text-[12px] font-bold text-thread-deep">{r.proposal!.kind === "cancel" ? "Cancellation" : "Change"} to</p>
                <Link href={`/events/${r.event_id}`} className="font-display block text-[17px] leading-tight font-bold underline-offset-4 hover:underline">
                  {r.event_title}
                </Link>
                <ChangeList p={r.proposal!} now={now} />
                {r.ai_note && <p className="mt-2 text-[13px] text-soft">{r.ai_note}</p>}
                <ProposalControls id={r.id} cancel={r.proposal!.kind === "cancel"} />
              </li>
            ))}
            {newEvents.map((r) => {
              const address = senderAddress(r.from_address ?? "");
              return (
                <li key={r.id} className="rounded-[28px] bg-card p-4">
                  <SenderLine r={r} now={now} />
                  <Link href={`/events/${r.event_id}`} className="font-display mt-1 block text-[17px] leading-tight font-bold underline-offset-4 hover:underline">
                    {r.event_title}
                  </Link>
                  <p className="mt-0.5 text-[13px] text-soft">{whenLabel(new Date(r.event_starts_at!), now)}</p>
                  {r.ai_note && <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-[13px] text-soft">{r.ai_note}</p>}
                  {r.confidence != null && <p className="mt-1.5 text-[12px] text-muted">AI confidence {Math.round(r.confidence * 100)}%</p>}
                  <ReviewControls id={r.event_id!} editHref={`/admin/events/${r.event_id}/edit`} />
                  {r.sender_verified && address && (
                    <div className="mt-1">
                      <OfficialSenderButton address={address} official={r.sender_official} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-h">
        <h2 id="recent-h" className="font-display mb-3 text-[20px] font-extrabold">
          Recent
        </h2>
        {recent.length === 0 ? (
          <p className="text-[14px] text-soft">Events found in mail show up here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((r) => {
              const o = OUTCOME[r.outcome] ?? OUTCOME.needs_review;
              const label = r.proposal?.auto ? (r.outcome === "cancelled" ? "Cancelled by sender" : "Updated by sender") : o.label;
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{r.event_title ?? r.subject ?? "Untitled mail"}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {senderName(r.from_address)} · {ago(r.received_at, now.getTime())}
                    </span>
                    {r.outcome === "error" && r.ai_note && <span className="mt-0.5 block text-[12px] text-warn">{r.ai_note}</span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap ${o.className}`}>{label}</span>
                </>
              );
              return (
                <li key={r.id}>
                  {r.event_id ? (
                    <Link href={`/events/${r.event_id}`} className="flex items-center gap-3 rounded-[22px] bg-card p-4 transition-transform active:scale-[0.99]">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-[22px] bg-card p-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
