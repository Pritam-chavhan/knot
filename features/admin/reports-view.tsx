import Link from "next/link";
import { chatTime, dayLabel, formatClock } from "@/lib/time";
import { REPORT_REASONS } from "@/features/chat/errors";
import { ReportControls } from "./report-controls";
import type { ReportRow } from "./queries";

const REASON = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label])) as Record<string, string>;
const TYPE = { profile: "Profile", message: "Chat message", event: "Event" } as const;
const RESOLUTION = { dismissed: "Dismissed", suspended: "Person suspended", event_hidden: "Event hidden" } as const;

type Thread = { from_reported: boolean; body: string; at: string }[];

export function ReportsView({ rows, open, now = new Date() }: { rows: ReportRow[]; open: boolean; now?: Date }) {
  return (
    <section aria-labelledby="reports-h" className="mt-6 mb-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="reports-h" className="font-display text-[20px] font-extrabold">
            Reports
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            {open ? "Oldest first. What was reported is saved as it was at that moment." : "Recently resolved."}
          </p>
        </div>
        <Link
          href={open ? "/admin/reports?view=closed" : "/admin/reports"}
          className="flex min-h-11 shrink-0 items-center rounded-full bg-card px-4 text-[13px] font-bold text-thread-deep"
        >
          {open ? "Resolved" : "Open reports"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-[24px] bg-card p-6 text-center">
          <p className="font-bold">{open ? "No open reports" : "Nothing resolved yet"}</p>
          <p className="mt-1 text-[14px] text-soft">
            {open ? "When a student reports a profile, a chat message or an event, it appears here." : "Reports you dismiss or act on are listed here."}
          </p>
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <article className="rounded-[26px] bg-card p-4" aria-label={`${TYPE[r.target_type]} reported for ${REASON[r.reason] ?? r.reason}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-rose-tint px-3 py-1 text-[12.5px] font-bold text-ink">{REASON[r.reason] ?? r.reason}</span>
                  <span className="rounded-full bg-paper px-3 py-1 text-[12.5px] font-bold text-soft">{TYPE[r.target_type]}</span>
                  <span className="ml-auto text-[12.5px] text-muted">{chatTime(new Date(r.created_at), now)}</span>
                </div>

                <p className="mt-3 text-[14px] text-soft">
                  Reported by <span className="font-bold text-ink">{r.reporter_name ?? "a student"}</span>
                  {r.subject_id && (
                    <>
                      {" "}about{" "}
                      <span className="font-bold text-ink">{r.subject_name ?? "a student"}</span>
                      {r.subject_status === "suspended" && <span className="ml-1.5 inline-block rounded-full bg-warn/10 px-2 py-0.5 whitespace-nowrap text-[12px] font-bold text-warn">Suspended</span>}
                      {open && r.subject_open_reports > 1 && (
                        <span className="ml-1.5 inline-block rounded-full bg-marigold-tint px-2 py-0.5 whitespace-nowrap text-[12px] font-bold text-ink">{r.subject_open_reports} open reports</span>
                      )}
                    </>
                  )}
                </p>
                {r.details && <p className="mt-2 rounded-[16px] bg-paper px-3.5 py-2.5 text-[14.5px] leading-snug">&ldquo;{r.details}&rdquo;</p>}

                <Evidence row={r} />

                {open ? (
                  <ReportControls
                    reportId={r.id}
                    subjectName={r.subject_name?.split(" ")[0] ?? null}
                    canSuspend={!!r.subject_id && r.subject_status === "active" && !r.subject_protected}
                    protectedSubject={r.subject_protected}
                    canHide={r.target_type === "event" && !r.event_hidden}
                  />
                ) : (
                  <p className="mt-3 text-[13px] font-semibold text-river-deep">
                    {r.resolution ? RESOLUTION[r.resolution] : "Resolved"}
                    {r.resolved_at && <span className="font-normal text-muted">, {chatTime(new Date(r.resolved_at), now)}</span>}
                  </p>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Evidence({ row }: { row: ReportRow }) {
  const s = (row.snapshot ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : null);

  if (row.target_type === "message") {
    const thread = (Array.isArray(s.thread) ? s.thread : []) as Thread;
    const sender = str("sender_name") ?? "Them";
    return (
      <details className="mt-3 rounded-[18px] border-[1.5px] border-line" open={thread.length <= 4}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center px-3.5 text-[13.5px] font-bold">
          The chat before the report ({thread.length} {thread.length === 1 ? "message" : "messages"})
        </summary>
        <ol className="flex flex-col gap-1.5 px-3 pb-3">
          {thread.map((m, i) => {
            const reported = i === thread.length - 1;
            return (
              <li key={i} className={`flex flex-col ${m.from_reported ? "items-start" : "items-end"}`}>
                <span className="px-1 text-[11.5px] text-muted">
                  {m.from_reported ? sender : "Reporter"}, {formatClock(new Date(m.at))}
                </span>
                <p
                  className={`max-w-[85%] rounded-[16px] px-3 py-2 text-[14px] leading-snug break-words whitespace-pre-wrap ${
                    reported ? "bg-rose-tint ring-2 ring-rose" : m.from_reported ? "bg-paper" : "bg-thread-tint"
                  }`}
                >
                  {m.body}
                </p>
              </li>
            );
          })}
        </ol>
      </details>
    );
  }

  if (row.target_type === "event") {
    const starts = str("starts_at");
    return (
      <div className="mt-3 rounded-[18px] border-[1.5px] border-line p-3.5">
        <p className="font-bold">{str("title")}</p>
        <p className="text-[13px] text-muted">
          {[starts && `${dayLabel(new Date(starts))}, ${formatClock(new Date(starts))}`, str("venue"), str("source_type") === "student_hosted" ? `Hosted by ${str("host_name") ?? "a student"}` : "Campus event"]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {str("description") && <p className="mt-2 line-clamp-4 text-[14px] whitespace-pre-wrap text-soft">{str("description")}</p>}
        {row.event_hidden && <p className="mt-2 text-[12.5px] font-bold text-warn">Hidden from students</p>}
        <Link href={`/events/${row.target_id}`} className="mt-2 inline-flex min-h-11 items-center text-[13.5px] font-bold text-thread-deep underline-offset-4 hover:underline">
          Open event
        </Link>
      </div>
    );
  }

  const links = [["GitHub", str("github")], ["Instagram", str("instagram")], ["LinkedIn", str("linkedin")]].filter(([, v]) => v) as [string, string][];
  return (
    <div className="mt-3 rounded-[18px] border-[1.5px] border-line p-3.5">
      <p className="font-bold">{str("display_name") ?? "No name"}</p>
      <p className="text-[13px] text-muted">
        {[str("programme"), typeof s.batch_year === "number" && `Class of ${s.batch_year}`, s.has_photo ? "Has a photo" : "No photo"].filter(Boolean).join(" · ")}
      </p>
      {str("bio") && <p className="mt-2 text-[14px] text-soft">{str("bio")}</p>}
      {links.length > 0 && <p className="mt-1 text-[13px] text-muted">{links.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
      {row.subject_status === "active" && (
        <Link href={`/people/${row.target_id}`} className="mt-1 inline-flex min-h-11 items-center text-[13.5px] font-bold text-thread-deep underline-offset-4 hover:underline">
          Open profile
        </Link>
      )}
    </div>
  );
}
