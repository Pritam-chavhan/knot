"use client";

// Hands-on examples for the landing page and the welcome tour. They run
// entirely in the browser with made-up students; nothing is saved or sent.
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./ui";
import { TagPill } from "./art";

function useLater() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Going: tap it, your face joins the people already going             */
/* ------------------------------------------------------------------ */

const GOING_FACES = ["Aarav M", "Ishita R", "Zoya K", "Neel T"];

export function GoingDemo({ className = "" }: { className?: string }) {
  const [going, setGoing] = useState(false);
  const count = 14 + (going ? 1 : 0);

  return (
    <div className={`rounded-[28px] bg-card p-5 shadow-[0_24px_60px_-28px_rgba(23,20,43,0.45)] ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <TagPill tag="student" />
        <span className="text-[13px] font-semibold text-muted">Tonight, 11:00 pm</span>
      </div>
      <p className="font-display mt-3 text-[22px] leading-[1.1] font-bold">Maggi and board games till late</p>
      <p className="mt-1 text-[14px] text-muted">Just Chill Cafe, Beauki · hosted by Ishita</p>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex -space-x-2">
          {going && (
            <span className="pop-in relative z-10">
              <Avatar name="You" size={38} index={1} className="ring-marigold-tint" />
            </span>
          )}
          {GOING_FACES.map((p, i) => (
            <Avatar key={p} name={p} size={38} index={i + 2} />
          ))}
        </div>
        <p className="text-[14px] leading-tight text-soft">
          <span className="font-display block text-[22px] leading-none font-extrabold text-ink tabular-nums">{count}</span>
          going
        </p>
      </div>

      <p aria-live="polite" className="mt-4 rounded-2xl bg-marigold-tint px-3.5 py-2.5 text-[14px] leading-snug text-ink">
        {going ? (
          <>
            <span className="font-bold">You&apos;re in.</span> Zoya and Neel from your batch will see you there.
          </>
        ) : (
          <>
            <span className="font-bold">Zoya and Neel from your batch</span> are going.
          </>
        )}
      </p>

      <button
        type="button"
        aria-pressed={going}
        onClick={() => setGoing((g) => !g)}
        className={`mt-3 flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold transition-colors ${
          going ? "bg-marigold text-ink" : "bg-ink text-white hover:bg-black"
        }`}
      >
        {going ? (
          <>
            <Check /> You&apos;re going
          </>
        ) : (
          "I'm going"
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Host: ask to join, get let in                                       */
/* ------------------------------------------------------------------ */

export function HostDemo({ className = "" }: { className?: string }) {
  const [stage, setStage] = useState<"open" | "asked" | "in">("open");
  const later = useLater();
  const filled = stage === "in" ? 4 : 3;

  const ask = () => {
    if (stage !== "open") return setStage("open");
    setStage("asked");
    later(() => setStage("in"), 1400);
  };

  return (
    <div className={`rounded-[24px] bg-card p-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        <Avatar name="Rohan V" size={36} index={2} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Rohan is hosting</p>
          <p className="truncate text-[13px] text-muted">Today, 6:00 pm · Sports complex</p>
        </div>
      </div>
      <p className="font-display mt-3 text-[19px] leading-tight font-bold">Badminton doubles, need one more</p>
      <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-2.5 flex-1 rounded-full transition-colors duration-500 ${i < filled ? "bg-river" : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-[13px] font-semibold text-river-deep">{filled === 4 ? "Full: 4 of 4" : "3 of 4 spots taken"}</p>

      <div aria-live="polite" className="min-h-[24px]">
        {stage === "in" && <p className="pop-in mt-2 text-[14px] font-semibold text-ink">Rohan let you in. See you on court at 6.</p>}
      </div>

      <button
        type="button"
        onClick={ask}
        disabled={stage === "asked"}
        className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold transition-colors ${
          stage === "in" ? "bg-river-tint text-river-deep" : "bg-river-deep text-white hover:bg-[#085e54]"
        } disabled:opacity-80`}
      >
        {stage === "open" && "Ask to join"}
        {stage === "asked" && "Asking Rohan…"}
        {stage === "in" && (
          <>
            <Check /> You&apos;re in · Undo
          </>
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Map: wave at a friend nearby, they wave back                        */
/* ------------------------------------------------------------------ */

const FRIENDS = [
  { name: "Ananya S", first: "Ananya", where: "Tea Post, Emiet", x: 72, y: 30, i: 0 },
  { name: "Kabir N", first: "Kabir", where: "Central Arcade", x: 30, y: 26, i: 2 },
  { name: "Meera P", first: "Meera", where: "the library", x: 40, y: 74, i: 3 },
];

export function MapDemo({ className = "" }: { className?: string }) {
  const [waved, setWaved] = useState<string | null>(null);
  const [back, setBack] = useState(false);
  const later = useLater();
  const friend = FRIENDS.find((f) => f.name === waved);

  const wave = (name: string) => {
    setWaved(name);
    setBack(false);
    later(() => setBack(true), 1300);
  };

  return (
    <div className={`overflow-hidden rounded-[24px] bg-card ${className}`}>
      <div className="relative aspect-[3/2] w-full bg-[#eef0f4]">
        <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="none">
          <path d="M262 0 C 245 60, 290 120, 258 200 L 300 200 L 300 0 Z" fill="#cfe9f0" />
          <path d="M0 110 H 250 M 120 0 V 200 M 40 30 Q 120 100 250 40" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" />
          {[
            [20, 132, 60, 50],
            [150, 140, 80, 44],
            [180, 74, 50, 24],
            [150, 8, 76, 26],
          ].map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx="8" fill="#dfe1ea" />
          ))}
        </svg>
        <span className="absolute right-[3%] bottom-[44%] rotate-90 text-[10px] font-semibold text-[#3f7d8c]" aria-hidden="true">
          Sabarmati
        </span>

        {/* You */}
        <span className="absolute top-[52%] left-[52%] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
          <span className="live-ping absolute inset-0 rounded-full bg-thread" />
          <span className="relative block h-5 w-5 rounded-full border-[3px] border-white bg-thread" />
        </span>

        {FRIENDS.map((f) => {
          const active = waved === f.name;
          return (
            <button
              key={f.name}
              type="button"
              onClick={() => wave(f.name)}
              aria-label={`Wave at ${f.first}, near ${f.where}`}
              className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform active:scale-90"
              style={{ left: `${f.x}%`, top: `${f.y}%` }}
            >
              <Avatar name={f.name} size={34} index={f.i} className={active ? "ring-marigold" : ""} />
              {active && back && (
                <span className="pop-in absolute -top-3 -right-3 rounded-full bg-marigold px-1.5 py-0.5 text-[13px]" aria-hidden="true">
                  👋
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="min-h-[56px] px-4 py-3 text-[14px] leading-snug text-soft">
        {!friend && (
          <>
            <span className="font-bold text-ink">Three friends are nearby.</span> Tap one to wave.
          </>
        )}
        {friend && !back && <span className="font-semibold text-ink">Wave sent to {friend.first}…</span>}
        {friend && back && (
          <>
            <span className="font-bold text-ink">{friend.first} waved back</span> from {friend.where}. Go say hi.
          </>
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Privacy: flip the switches, see what others see                     */
/* ------------------------------------------------------------------ */

function DemoSwitch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left text-[15px] font-semibold"
    >
      {label}
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-thread" : "bg-line"}`} aria-hidden="true">
        <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

export function PrivacyDemo({ className = "" }: { className?: string }) {
  const [visible, setVisible] = useState(true);
  const [sharing, setSharing] = useState(false);
  return (
    <div className={`rounded-[24px] bg-card p-4 ${className}`}>
      <DemoSwitch on={visible} onChange={setVisible} label="Show me as going" />
      <div className="h-px bg-line" />
      <DemoSwitch on={sharing} onChange={setSharing} label="Share my location" />
      <div className="mt-3 rounded-2xl bg-paper p-3.5" aria-live="polite">
        <p className="text-[12px] font-semibold text-muted">What other students see</p>
        <div className="mt-2 flex items-center gap-2.5">
          {visible ? <Avatar name="You" size={32} index={1} /> : <span className="h-8 w-8 rounded-full bg-line" aria-hidden="true" />}
          <p className="text-[14px] font-semibold">{visible ? "You're on the list of people going" : "One more person is going"}</p>
        </div>
        <p className="mt-2 text-[13px] text-soft">
          {sharing ? "You're on the live map until 11:30 pm, then it switches off." : "You're not on the map."}
        </p>
      </div>
    </div>
  );
}
