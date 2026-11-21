import Link from "next/link";
import { ago } from "./format";
import { AutoRefresh } from "./auto-refresh";

export type Signup = {
  id: string;
  email: string;
  display_name: string | null;
  programme: string | null;
  batch_year: number | null;
  status: string;
  stage: "code_sent" | "verified" | "joined";
  started_at: string;
  verified_at: string | null;
  joined_at: string | null;
  last_seen_at: string | null;
  help_emails: number;
  last_help_at: string | null;
};

// A student counts as stuck after this long at a step.
const STUCK_MIN = { code_sent: 5, verified: 20 } as const;

export function isStuck(s: Signup, now: number) {
  if (s.stage === "joined") return false;
  const since = s.stage === "code_sent" ? s.started_at : (s.verified_at ?? s.started_at);
  return now - new Date(since).getTime() > STUCK_MIN[s.stage] * 60_000;
}

const STAGE = {
  code_sent: { label: "Code sent", tone: "bg-marigold-tint text-ink" },
  verified: { label: "Verified", tone: "bg-thread-tint text-thread-deep" },
  joined: { label: "Joined", tone: "bg-river-tint text-river-deep" },
} as const;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "stuck", label: "Stuck" },
  { id: "code_sent", label: "Code sent" },
  { id: "verified", label: "Verified" },
  { id: "joined", label: "Joined" },
] as const;
export type Filter = (typeof FILTERS)[number]["id"];

export function SignupsView({ rows, filter, helperSeen = null, now = Date.now() }: { rows: Signup[]; filter: Filter; helperSeen?: string | null; now?: number }) {
  const count = (st: Signup["stage"]) => rows.filter((r) => r.stage === st).length;
  const stuck = rows.filter((r) => isStuck(r, now));
  const today = rows.filter((r) => now - new Date(r.started_at).getTime() < 86_400_000).length;
  const helped = rows.filter((r) => r.help_emails > 0);
  const recovered = helped.filter((r) => r.stage === "joined").length;
  const helperOn = !!helperSeen && now - new Date(helperSeen).getTime() < 30 * 60_000;
  const shown = filter === "all" ? rows : filter === "stuck" ? stuck : rows.filter((r) => r.stage === filter);

  return (
    <section className="mt-5" aria-labelledby="signups-h">
      <AutoRefresh seconds={30} />
      <h2 id="signups-h" className="sr-only">
        Sign-ups
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {(["code_sent", "verified", "joined"] as const).map((st) => (
          <div key={st} className="rounded-[20px] bg-card px-3 py-3">
            <p className="font-display text-[28px] leading-none font-extrabold">{count(st)}</p>
            <p className="mt-1 text-[12.5px] font-semibold text-soft">{STAGE[st].label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13.5px] text-soft">
        {today} started in the last 24 hours.{" "}
        {stuck.length > 0 ? (
          <span className="font-semibold text-warn">{stuck.length} look stuck.</span>
        ) : (
          "Nobody is stuck."
        )}{" "}
        Updates every 30 seconds.
      </p>
      <p className={`mt-2 flex items-center gap-2 rounded-[16px] px-3 py-2.5 text-[13px] ${helperOn ? "bg-river-tint text-river-deep" : "bg-marigold-tint text-ink"}`}>
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${helperOn ? "bg-river" : "bg-marigold"}`} />
        <span>
          {helperOn ? (
            <>
              <span className="font-bold">Sign-up helper is on</span> · checked {ago(helperSeen, now).toLowerCase()}. {helped.length} emailed, {recovered} got in after.
            </>
          ) : (
            <>
              <span className="font-bold">Sign-up helper is off.</span> Run &ldquo;setupHelper&rdquo; in the campus mail script to turn it on.
            </>
          )}
        </span>
      </p>

      <nav aria-label="Filter sign-ups" className="-mx-5 mt-4 overflow-x-auto px-5">
        <ul className="flex gap-2">
          {FILTERS.map((f) => (
            <li key={f.id}>
              <Link
                href={f.id === "all" ? "/admin/signups" : `/admin/signups?stage=${f.id}`}
                aria-current={filter === f.id ? "page" : undefined}
                className={`flex min-h-10 items-center rounded-full px-4 text-[14px] font-bold whitespace-nowrap ${filter === f.id ? "bg-ink text-white" : "bg-card text-soft"}`}
              >
                {f.label}
                {f.id === "stuck" && stuck.length > 0 ? ` · ${stuck.length}` : ""}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {shown.length === 0 ? (
        <p className="mt-5 rounded-[24px] bg-card p-5 text-center text-soft">Nobody here right now.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {shown.map((s) => (
            <SignupRow key={s.id} s={s} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SignupRow({ s, now }: { s: Signup; now: number }) {
  const stuck = isStuck(s, now);
  const detail =
    s.stage === "joined"
      ? `Joined ${ago(s.joined_at, now)}${s.last_seen_at ? ` · last seen ${ago(s.last_seen_at, now).toLowerCase()}` : ""}`
      : s.stage === "verified"
        ? `Entered the code ${ago(s.verified_at, now).toLowerCase()}, profile not finished`
        : `Asked for a code ${ago(s.started_at, now).toLowerCase()}, hasn't entered it`;
  const who = [s.display_name, [s.programme, s.batch_year ? `'${String(s.batch_year).slice(-2)}` : null].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  return (
    <li className={`rounded-[20px] bg-card px-4 py-3 ${stuck ? "ring-2 ring-warn/40" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{s.email}</p>
          {who && <p className="truncate text-[13px] text-soft">{who}</p>}
          <p className={`mt-1 text-[13px] ${stuck ? "font-semibold text-warn" : "text-muted"}`}>
            {detail}
            {s.status === "suspended" ? " · suspended" : ""}
          </p>
          {s.help_emails > 0 && (
            <p className={`mt-0.5 text-[12.5px] font-semibold ${s.stage === "joined" ? "text-river-deep" : "text-soft"}`}>
              {s.stage === "joined"
                ? `Got in after ${s.help_emails === 1 ? "a help email" : `${s.help_emails} help emails`}`
                : `Help email${s.help_emails === 1 ? "" : "s"} sent: ${s.help_emails}, last ${ago(s.last_help_at, now).toLowerCase()}`}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${STAGE[s.stage].tone}`}>{STAGE[s.stage].label}</span>
      </div>
      {stuck && (
        <a
          href={`mailto:${s.email}?subject=${encodeURIComponent("Need a hand getting into KNOT?")}&body=${encodeURIComponent(
            "Hi! I saw you started signing up for KNOT. If the code didn't arrive, check Spam or Promotions and search for \"KNOT\". You can ask for a new code on the sign-in screen. Reply here if you're still stuck.\n\nPritam",
          )}`}
          className="mt-2 inline-flex min-h-10 items-center rounded-full border-[1.5px] border-line px-3.5 text-[13px] font-bold"
        >
          Email to help
        </a>
      )}
    </li>
  );
}
