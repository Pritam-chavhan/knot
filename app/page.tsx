import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { KnotMark, Logo } from "@/components/ui";
import { DayTimeline, SafetyList } from "@/components/art";
import { GoingDemo, HostDemo, MapDemo, PrivacyDemo } from "@/components/demos";
import { SignInForm } from "./sign-in-form";

const ERRORS: Record<string, string> = {
  suspended: "This account is suspended. Contact the KNOT team if you think this is a mistake.",
  "no-profile": "We couldn't find your profile. Sign in again to continue.",
  link: "That sign-in link has expired or was opened in a different browser. Request a new one below.",
};

function TryLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-muted">
      <KnotMark size={16} className="text-thread" />
      {children}
    </p>
  );
}

const DEMOS = [
  {
    title: "Start a plan, fill it in minutes",
    body: "Need a fourth for badminton? Post it. People ask, you let them in.",
    tint: "bg-river-tint",
    demo: <HostDemo className="mt-4" />,
  },
  {
    title: "Wave at friends nearby",
    body: "See who's out right now, and turn a wave into chai at Tea Post.",
    tint: "bg-rose-tint",
    demo: <MapDemo className="mt-4" />,
  },
  {
    title: "You decide who sees you",
    body: "Flip the switches and see what other students would see.",
    tint: "bg-[#e6e8ef]",
    demo: <PrivacyDemo className="mt-4" />,
  },
];

export default async function Landing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/discover");
  const { error } = await searchParams;

  return (
    <div className="overflow-x-clip">
      {/* Hero: the promise, the sign-in, then something to tap */}
      <main className="mx-auto max-w-md px-5 pt-6 pb-14 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-16 lg:pt-8 lg:pb-20">
        <header className="flex items-center justify-between lg:col-span-2 lg:mb-6">
          <Logo />
          <span className="rounded-full bg-card px-3 py-1.5 text-[12px] font-semibold text-soft">Only for IIT Gandhinagar</span>
        </header>

        <div>
          <h1 className="font-display mt-9 text-[46px] leading-[0.93] font-extrabold sm:text-[58px] lg:mt-0 lg:text-[64px]">
            Stop hearing about it the next day.
          </h1>
          <p className="mt-5 max-w-[36ch] text-[17px] leading-relaxed text-soft">
            Talks, fests, club meetups and late-night plans at IITGN, in one feed. See who&apos;s going, and never walk in alone.
          </p>

          {error && ERRORS[error] && (
            <p role="alert" className="mt-5 rounded-2xl bg-warn/10 p-4 text-sm font-medium text-warn">
              {ERRORS[error]}
            </p>
          )}

          <div id="join" className="mt-7 scroll-mt-6 rounded-[28px] bg-card p-5 shadow-[0_20px_50px_-30px_rgba(23,20,43,0.45)]">
            <SignInForm />
          </div>
        </div>

        <div className="mt-14 lg:mt-0">
          <div className="relative isolate">
            <div className="absolute -inset-x-2 -top-4 -bottom-4 -z-10 rotate-[-3deg] rounded-[36px] bg-thread" aria-hidden="true" />
            <GoingDemo />
          </div>
          <TryLabel>Try it: tap &ldquo;I&apos;m going&rdquo;</TryLabel>
        </div>
      </main>

      {/* A day on campus */}
      <section aria-labelledby="day-h" className="bg-thread-tint">
        <div className="mx-auto max-w-md px-5 py-12 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:gap-16 lg:py-16">
          <div>
            <h2 id="day-h" className="font-display text-[34px] leading-[1.02] font-extrabold lg:text-[42px]">
              Your whole day on campus, on one screen
            </h2>
            <p className="mt-3 max-w-[38ch] text-[16px] leading-relaxed text-soft">
              No more digging through your inbox. Institute events, club meetups and plans other students start, sorted by time,
              each with how many people are going.
            </p>
          </div>
          <div className="mt-6 lg:mt-0">
            <DayTimeline />
          </div>
        </div>
      </section>

      {/* Hands-on demos */}
      <section aria-labelledby="try-h" className="mx-auto max-w-md px-5 py-12 lg:max-w-5xl lg:py-16">
        <h2 id="try-h" className="font-display text-[34px] leading-[1.02] font-extrabold lg:text-[42px]">
          Go on, try it
        </h2>
        <p className="mt-3 max-w-[40ch] text-[16px] leading-relaxed text-soft">These work like the real thing. Nothing here is saved.</p>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {DEMOS.map((d) => (
            <article key={d.title} className={`min-w-0 rounded-[30px] p-4 pt-5 ${d.tint}`}>
              <h3 className="font-display px-1 text-[22px] leading-tight font-bold">{d.title}</h3>
              <p className="mt-1.5 px-1 text-[15px] text-soft">{d.body}</p>
              {d.demo}
            </article>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section aria-labelledby="safe-h" className="mx-auto max-w-md px-5 pb-12 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-16">
        <div>
          <h2 id="safe-h" className="font-display text-[34px] leading-[1.02] font-extrabold lg:text-[42px]">
            Just IITGN. No outsiders.
          </h2>
          <p className="mt-3 max-w-[38ch] text-[16px] leading-relaxed text-soft">
            No public profiles, no follower counts, no strangers from other colleges. Just people you might pass on the way to the mess.
          </p>
        </div>
        <div className="mt-6 lg:mt-0">
          <SafetyList />
        </div>
      </section>

      {/* Closing call to action */}
      <section aria-labelledby="cta-h" className="px-5 pb-10">
        <div className="relative mx-auto max-w-md overflow-hidden rounded-[34px] bg-ink px-6 py-10 text-white lg:max-w-5xl lg:px-14 lg:py-14">
          <KnotMark size={160} className="pointer-events-none absolute -top-10 -right-8 text-thread opacity-50" />
          <h2 id="cta-h" className="font-display relative max-w-[16ch] text-[34px] leading-[1.02] font-extrabold lg:text-[44px]">
            Tonight&apos;s plans are being made right now.
          </h2>
          <p className="relative mt-3 max-w-[34ch] text-[16px] text-white/75">Sign in with your college email. It takes a minute.</p>
          <a
            href="#join"
            className="relative mt-7 inline-flex h-14 items-center justify-center rounded-full bg-marigold px-7 text-[16px] font-bold text-ink hover:bg-[#ffc04d]"
          >
            Join with your college email
          </a>
        </div>
      </section>

      <footer className="mx-auto max-w-md px-5 pb-10 text-center text-[12px] leading-relaxed text-muted lg:max-w-5xl">
        An independent student project, not affiliated with IIT Gandhinagar. Events and people shown on this page are examples.
      </footer>
    </div>
  );
}
