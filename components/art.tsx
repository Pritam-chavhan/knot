// Static illustrations for the landing page and welcome tour. They show
// example content only; nothing here reads real data.
import { Avatar } from "./ui";

export type Tag = "campus" | "student";

const TAGS: Record<Tag, { label: string; className: string }> = {
  campus: { label: "Campus", className: "bg-thread-tint text-thread-deep" },
  student: { label: "Student-hosted", className: "bg-marigold-tint text-[#6e4300]" },
};

// onTint: for use on a background already tinted in the tag's colour.
export function TagPill({ tag, onTint = false }: { tag: Tag; onTint?: boolean }) {
  const t = TAGS[tag];
  const cls = onTint ? `bg-card ${t.className.split(" ").find((c) => c.startsWith("text-"))}` : t.className;
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{t.label}</span>;
}

// The signature: a thread that loops into a knot. It draws itself once.
export function Thread({ className = "", draw = true }: { className?: string; draw?: boolean }) {
  return (
    <svg viewBox="0 0 400 260" fill="none" aria-hidden="true" className={className} preserveAspectRatio="none">
      <path
        d="M-10 210 C 70 210, 110 60, 200 70 C 285 80, 262 190, 196 160 C 140 134, 210 40, 410 60"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        className={draw ? "thread-draw" : ""}
        style={{ ["--len" as string]: 900 }}
      />
    </svg>
  );
}

const DAY: { time: string; title: string; where: string; tag: Tag; note: string; faces: string[] }[] = [
  { time: "1:00 pm", title: "Amalthea speaker session", where: "Academic Block 1", tag: "campus", note: "62 going", faces: ["Riya D", "Om B", "Tara J"] },
  { time: "5:30 pm", title: "Hallabol football practice", where: "Sports complex", tag: "campus", note: "Need 2 more", faces: ["Dev M", "Kabir N"] },
  { time: "7:15 pm", title: "Sunset walk by the Sabarmati", where: "Meet outside Aibaan", tag: "student", note: "9 going", faces: ["Ananya S", "Lina R", "Neel T"] },
  { time: "11:00 pm", title: "Maggi and board games", where: "Just Chill Cafe, Beauki", tag: "student", note: "14 going", faces: ["Ishita R", "Zoya K", "Aarav M"] },
];

export function DayTimeline({ compact = false }: { compact?: boolean }) {
  return (
    <ol className="relative flex flex-col gap-3">
      <span className="absolute top-3 bottom-3 left-[7px] w-[2px] rounded-full bg-thread/25" aria-hidden="true" />
      {(compact ? DAY.slice(0, 3) : DAY).map((e) => (
        <li key={e.title} className="relative flex gap-3">
          <span className="relative z-10 mt-4 h-4 w-4 shrink-0 rounded-full border-[3px] border-paper bg-thread" aria-hidden="true" />
          <div className="min-w-0 flex-1 rounded-[20px] bg-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-[15px] font-bold">{e.time}</span>
              <TagPill tag={e.tag} />
            </div>
            <p className="mt-1 truncate text-[15px] font-bold">{e.title}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate text-[13px] text-muted">{e.where}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-soft">
                <span className="flex -space-x-1.5">
                  {e.faces.map((f, i) => (
                    <Avatar key={f} name={f} size={22} index={i + 1} className="ring-2" />
                  ))}
                </span>
                {e.note}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SafetyList() {
  const rows = [
    "Only @iitgn.ac.in emails can join",
    "You choose who sees you, event by event",
    "Block or report anyone, from anywhere",
    "The map is off until you switch it on",
  ];
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r} className="flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 text-[15px] font-semibold">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-river-deep text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          {r}
        </li>
      ))}
    </ul>
  );
}
