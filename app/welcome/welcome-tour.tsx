"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FeedMini, GoingMini, HostMini, MapMini, SafetyMini, Thread } from "@/components/art";
import { Avatar, KnotMark } from "@/components/ui";

type Slide = { title: string; body: string; points?: string[]; art: ReactNode; bg: string; dark?: boolean };

function WelcomeArt() {
  return (
    <div className="relative mx-auto h-[220px] w-full max-w-[320px]">
      <Thread className="absolute inset-0 h-full w-full text-white/90" />
      {[
        { n: "Asha K", x: "6%", y: "62%" },
        { n: "Ravi P", x: "40%", y: "12%" },
        { n: "Meera S", x: "78%", y: "6%" },
      ].map((p, i) => (
        <span key={p.n} className="pop-in absolute" style={{ left: p.x, top: p.y, animationDelay: `${0.5 + i * 0.35}s` }}>
          <Avatar name={p.n} size={52} index={i + 1} className="ring-thread" />
        </span>
      ))}
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: "Welcome to KNOT",
    body: "KNOT ties campus together: every event happening at IITGN, the people going to it, and an easy way to go together.",
    art: <WelcomeArt />,
    bg: "bg-thread",
    dark: true,
  },
  {
    title: "Everything happening, in one feed",
    body: "Events from official mails, clubs and fellow students, sorted by day so you can plan your week at a glance.",
    points: ["Official: verified campus events", "Club: from clubs and societies", "Student-hosted: plans made by students"],
    art: <FeedMini />,
    bg: "bg-thread-tint",
  },
  {
    title: "Say you're interested, or going",
    body: "Everyone sees how many are going. If you choose, others going can see you too, so nobody has to show up alone.",
    points: ["Change your mind any time", "Hide yourself on any event"],
    art: <GoingMini />,
    bg: "bg-marigold-tint",
  },
  {
    title: "Host your own plan",
    body: "Start anything: a match, a study group, a late-night chai run. Set the number of spots and decide whether people can join straight away or ask first.",
    art: <HostMini />,
    bg: "bg-river-tint",
  },
  {
    title: "Find friends on the live map",
    body: "When you switch it on, friends can see where you are on campus and wave to meet up. It turns itself off after a few hours.",
    points: ["Off until you turn it on", "One tap to stop sharing", "No location history is kept"],
    art: <MapMini />,
    bg: "bg-rose-tint",
  },
  {
    title: "You're in control",
    body: "KNOT is only for IITGN students. You decide who can see you and who can reach you.",
    art: <SafetyMini />,
    bg: "bg-[#e6e8ef]",
  },
];

export function WelcomeTour({ finishHref, finishLabel }: { finishHref: string; finishLabel: string }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const touchX = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  // Move focus to the new heading after each step, so screen readers announce it.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [i]);

  const s = SLIDES[i];

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <section className={`relative flex flex-col px-5 pt-5 pb-8 transition-colors duration-500 ${s.bg} rounded-b-[36px]`}>
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
              className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${s.dark ? "text-white hover:bg-white/15" : "text-ink hover:bg-ink/5"}`}
            >
              Skip
            </Link>
          )}
        </div>
        <div key={i} className="pop-in mt-8 flex min-h-[250px] items-center justify-center [animation-duration:0.5s]">
          <div className="w-full max-w-[340px]">{s.art}</div>
        </div>
      </section>

      <section className="flex flex-1 flex-col px-6 pt-7 pb-6" aria-live="polite">
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

        <div className="mt-auto flex items-center gap-3 pt-8">
          {i > 0 && (
            <button
              type="button"
              onClick={() => go(i - 1)}
              aria-label="Previous"
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
      </section>
    </main>
  );
}
