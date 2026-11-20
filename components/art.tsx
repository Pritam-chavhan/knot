// Illustrations used on the landing page and in the welcome tour. They show
// how KNOT works with example content; nothing here reads real data.
import { Avatar } from "./ui";

type Tag = "official" | "club" | "student";

const TAGS: Record<Tag, { label: string; className: string }> = {
  official: { label: "Official", className: "bg-thread-tint text-thread-deep" },
  club: { label: "Club", className: "bg-river-tint text-river-deep" },
  student: { label: "Student-hosted", className: "bg-marigold-tint text-[#7a4b00]" },
};

export function TagPill({ tag }: { tag: Tag }) {
  const t = TAGS[tag];
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${t.className}`}>{t.label}</span>;
}

export function EventMock({
  tag,
  title,
  when,
  where,
  going,
  people,
  mine = false,
  className = "",
}: {
  tag: Tag;
  title: string;
  when: string;
  where: string;
  going: number;
  people: string[];
  mine?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-[26px] bg-card p-4 shadow-[0_18px_40px_-18px_rgba(23,20,43,0.35)] ${className}`}>
      <div className="flex items-center justify-between">
        <TagPill tag={tag} />
        <span className="text-[12px] font-semibold text-muted">{when}</span>
      </div>
      <p className="mt-3 font-display text-[19px] leading-tight font-bold text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-muted">{where}</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex -space-x-2">
          {people.map((p, i) => (
            <Avatar key={p} name={p} size={30} index={i} />
          ))}
        </div>
        <span className="text-[13px] font-semibold text-soft">
          <span className="font-display text-[17px] font-extrabold text-ink">{going}</span> going
        </span>
        <span
          className={`ml-auto rounded-full px-3.5 py-2 text-[13px] font-bold ${mine ? "bg-marigold text-ink" : "border-[1.5px] border-line text-ink"}`}
        >
          {mine ? "Going ✓" : "+ Going"}
        </span>
      </div>
    </div>
  );
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

export function HeroScene() {
  return (
    <div className="relative mx-auto h-[362px] w-full max-w-[380px]">
      <Thread className="absolute inset-x-[-24px] top-[18px] h-[250px] w-[calc(100%+48px)] text-thread" />
      <EventMock
        tag="club"
        title="Open lab: build a line follower"
        when="Sat, 4 pm"
        where="Makerspace, AB 6"
        going={12}
        people={["Ira S", "Dev M", "Kabir N"]}
        className="absolute top-0 right-0 w-[78%] rotate-[3deg]"
      />
      <EventMock
        tag="official"
        title="Jazz night at the amphitheatre"
        when="Fri, 8 pm"
        where="Open Air Theatre"
        going={38}
        people={["Asha K", "Ravi P", "Meera S", "Neel T"]}
        mine
        className="pop-in absolute bottom-0 left-0 w-[86%] -rotate-[2deg] [animation-delay:1.1s]"
      />
    </div>
  );
}

export function FeedMini() {
  const rows = [
    { time: "10:00", title: "Guest talk: robots in farms", tag: "official" as Tag },
    { time: "17:30", title: "Football, 5-a-side", tag: "student" as Tag },
    { time: "21:00", title: "Quiz club: movie trivia", tag: "club" as Tag },
  ];
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.title} className="flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3">
          <span className="w-11 font-display text-[15px] font-bold text-ink">{r.time}</span>
          <span className="flex-1 truncate text-[14px] font-semibold text-ink">{r.title}</span>
          <TagPill tag={r.tag} />
        </div>
      ))}
    </div>
  );
}

export function GoingMini() {
  return (
    <div className="rounded-[22px] bg-card p-4">
      <p className="font-display text-[17px] font-bold">Hackathon kickoff</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-thread-tint p-3">
          <p className="font-display text-[26px] leading-none font-extrabold text-thread-deep">64</p>
          <p className="mt-1 text-[12px] font-semibold text-thread-deep">interested</p>
        </div>
        <div className="rounded-2xl bg-marigold p-3">
          <p className="font-display text-[26px] leading-none font-extrabold text-ink">27</p>
          <p className="mt-1 text-[12px] font-semibold text-ink">going</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex -space-x-2">
          {["Tara J", "Om B", "Lina R"].map((p, i) => (
            <Avatar key={p} name={p} size={26} index={i + 1} />
          ))}
        </div>
        <span className="text-[12px] text-muted">3 people you share interests with</span>
      </div>
    </div>
  );
}

export function HostMini() {
  return (
    <div className="rounded-[22px] bg-card p-4">
      <div className="flex items-center gap-2.5">
        <Avatar name="Rohan V" size={34} index={2} />
        <div>
          <p className="text-[13px] font-semibold">Rohan is hosting</p>
          <p className="text-[12px] text-muted">Today, 6:00 pm · Sports complex</p>
        </div>
      </div>
      <p className="mt-3 font-display text-[18px] font-bold">Badminton doubles, need 1 more</p>
      <div className="mt-3 flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-2.5 flex-1 rounded-full ${i < 3 ? "bg-river" : "bg-line"}`} />
        ))}
        <span className="ml-2 text-[12px] font-semibold text-river-deep">3 of 4</span>
      </div>
      <span className="mt-3 inline-flex rounded-full bg-river px-4 py-2 text-[13px] font-bold text-white">Ask to join</span>
    </div>
  );
}

export function MapMini({ className = "" }: { className?: string }) {
  const people = [
    { x: 92, y: 70, c: "#5a3df0", n: "AK" },
    { x: 196, y: 54, c: "#f2547d", n: "RP" },
    { x: 228, y: 128, c: "#0e9f8e", n: "MS" },
    { x: 140, y: 150, c: "#17142b", n: "NT" },
  ];
  return (
    <div className={`overflow-hidden rounded-[22px] bg-card ${className}`}>
      <svg viewBox="0 0 300 200" className="block h-auto w-full" role="img" aria-label="Example campus map with friends nearby">
        <rect width="300" height="200" fill="#eef0f4" />
        <path d="M262 0 C 245 60, 290 120, 258 200 L 300 200 L 300 0 Z" fill="#cfe9f0" />
        <text x="276" y="104" fontSize="9" fill="#4a8a9a" fontWeight="600" transform="rotate(80 276 104)">Sabarmati</text>
        <path d="M0 110 H 250 M 120 0 V 200 M 40 30 Q 120 100 250 40" stroke="#ffffff" strokeWidth="9" fill="none" strokeLinecap="round" />
        {[
          [20, 20, 70, 40],
          [150, 14, 70, 26],
          [30, 130, 60, 50],
          [150, 140, 80, 44],
          [180, 74, 50, 24],
        ].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="8" fill="#dfe1ea" />
        ))}
        <circle cx="165" cy="100" r="8" fill="#5a3df0" className="live-ping" />
        <circle cx="165" cy="100" r="8" fill="#5a3df0" stroke="#fff" strokeWidth="3" />
        {people.map((p) => (
          <g key={p.n}>
            <circle cx={p.x} cy={p.y} r="13" fill={p.c} stroke="#fff" strokeWidth="3" />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
              {p.n}
            </text>
          </g>
        ))}
        <g transform="translate(206 20)">
          <rect width="62" height="24" rx="12" fill="#ffb020" />
          <text x="31" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#17142b">
            Wave 👋
          </text>
        </g>
      </svg>
    </div>
  );
}

export function SafetyMini() {
  const rows = [
    "Only @iitgn.ac.in emails can join",
    "You choose who sees you, per event",
    "Block or report anyone, from anywhere",
  ];
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r} className="flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 text-[14px] font-semibold">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-river text-white">
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
