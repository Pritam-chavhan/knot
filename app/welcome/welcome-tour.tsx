"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DayTimeline, Thread } from "@/components/art";
import { GoingDemo, HostDemo, MapDemo, PrivacyDemo } from "@/components/demos";
import { Avatar, KnotMark } from "@/components/ui";
import { askPermission } from "@/features/notifications/push-client";

type Slide = { title: string; body: string; points?: string[]; tryIt?: string; art: ReactNode; bg: string; dark?: boolean };

function WelcomeArt() {
  const faces = [
    { n: "Ananya S", x: "4%", y: "64%" },
    { n: "Rohan V", x: "40%", y: "14%" },
    { n: "Zoya K", x: "80%", y: "8%" },
  ];
  return (
    <div className="relative mx-auto h-[230px] w-full max-w-[320px]">
      <Thread className="absolute inset-0 h-full w-full text-white/90" />
      {faces.map((p, i) => (
        <span key={p.n} className="pop-in absolute" style={{ left: p.x, top: p.y, animationDelay: `${0.5 + i * 0.35}s` }}>
          <Avatar name={p.n} size={54} index={i + 1} className="ring-thread" />
        </span>
      ))}
      <span className="pop-in absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold text-thread-deep [animation-delay:1.7s]">
        + you
      </span>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: "Welcome to KNOT",
    body: "Campus is full of things to do. KNOT shows you what's on, who's going, and gets you there together. Here's how, in a minute.",
    art: <WelcomeArt />,
    bg: "bg-thread",
    dark: true,
  },
  {
    title: "Your day, in one feed",
    body: "Institute events, club meetups and plans other students start, sorted by time. The tag tells you whether it's a campus event or a student's plan.",
    art: <DayTimeline compact />,
    bg: "bg-thread-tint",
  },
  {
    title: "Tap Going. Find your people.",
    body: "Everyone sees how many are going. People going can see each other, so nobody has to walk in alone.",
    tryIt: "Try it: tap “I'm going”",
    art: <GoingDemo />,
    bg: "bg-marigold-tint",
  },
  {
    title: "Got a plan? Start it.",
    body: "Post a game, a study group or a chai run. Set the number of spots, and let people in.",
    tryIt: "Try it: ask to join",
    art: <HostDemo />,
    bg: "bg-river-tint",
  },
  {
    title: "Wave at friends nearby",
    body: "Switch on the live map when you're out. Friends can see you, and one wave starts the plan.",
    points: ["Off until you turn it on", "Turns itself off after a few hours", "No location history is kept"],
    tryIt: "Try it: tap a friend",
    art: <MapDemo />,
    bg: "bg-rose-tint",
  },
  {
    title: "You're in control",
    body: "Only IITGN students are here, and you choose what they see. Block or report anyone, from anywhere.",
    tryIt: "Try the switches",
    art: <PrivacyDemo />,
    bg: "bg-[#e6e8ef]",
  },
];

export function WelcomeTour({ finishHref, finishLabel }: { finishHref: string; finishLabel: string }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const touchX = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("button, a, input")) return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  // Move focus to the new heading after each step, so screen readers announce it.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [i]);

  const s = SLIDES[i];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper">
      <section
        className={`flex flex-col rounded-b-[36px] px-5 pt-5 pb-7 transition-colors duration-500 ${s.bg}`}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          // Swipes that start on a demo control shouldn't change the step.
          if (Math.abs(dx) > 60 && !(e.target as HTMLElement).closest("button")) go(i + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {SLIDES.map((_, n) => (
              <span key={n} className={`h-1.5 flex-1 overflow-hidden rounded-full ${s.dark ? "bg-white/25" : "bg-ink/10"}`}>
                <span
                  className={`block h-full rounded-full transition-[width] duration-500 ${s.dark ? "bg-white" : "bg-ink"}`}
                  style={{ width: n <= i ? "100%" : "0%" }}
                />
              </span>
            ))}
          </div>
          {!last && (
            <Link
              href={finishHref}
              onClick={() => void askPermission()}
              className={`-mr-2 flex min-h-11 items-center rounded-full px-3.5 text-[14px] font-bold ${
                s.dark ? "text-white hover:bg-white/15" : "text-ink hover:bg-ink/5"
              }`}
            >
              Skip
            </Link>
          )}
        </div>
        <div key={i} className="pop-in mt-6 flex min-h-[230px] items-center justify-center [animation-duration:0.45s]">
          <div className="w-full max-w-[350px]">{s.art}</div>
        </div>
        {s.tryIt && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-bold text-ink/70">
            <KnotMark size={16} className="text-thread" />
            {s.tryIt}
          </p>
        )}
      </section>

      <section className="flex flex-1 flex-col px-6 pt-6" aria-live="polite">
        <p className="text-[13px] font-semibold text-muted">
          {i + 1} of {SLIDES.length}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="font-display mt-1 text-[32px] leading-[1.02] font-extrabold focus:outline-none focus-visible:outline-none">
          {s.title}
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-soft">{s.body}</p>
        {s.points && (
          <ul className="mt-4 flex flex-col gap-2">
            {s.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[15px] text-ink">
                <KnotMark size={16} className="mt-[3px] shrink-0 text-thread" />
                {p}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        className="sticky bottom-0 mt-6 flex items-center gap-3 bg-gradient-to-t from-paper via-paper to-paper/0 px-6 pt-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        {i > 0 && (
          <button
            type="button"
            onClick={() => go(i - 1)}
            aria-label="Previous step"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-card hover:border-ink/30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
        {last ? (
          <Link
            href={finishHref}
              onClick={() => void askPermission()}
            className="flex h-14 flex-1 items-center justify-center rounded-full bg-thread text-[16px] font-bold text-white hover:bg-thread-deep"
          >
            {finishLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => go(i + 1)}
            className="flex h-14 flex-1 items-center justify-center rounded-full bg-ink text-[16px] font-bold text-white hover:bg-black"
          >
            {i === 0 ? "Show me around" : "Next"}
          </button>
        )}
      </div>
    </main>
  );
}
