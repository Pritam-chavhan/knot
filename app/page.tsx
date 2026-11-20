import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui";
import { FeedMini, GoingMini, HeroScene, HostMini, MapMini, SafetyMini } from "@/components/art";
import { SignInForm } from "./sign-in-form";

const ERRORS: Record<string, string> = {
  suspended: "This account is suspended. Contact the KNOT team if you think this is a mistake.",
  "no-profile": "We couldn't find your profile. Sign in again to continue.",
  link: "That sign-in link has expired or was opened in a different browser. Request a new one below.",
};

const FEATURES: { title: string; body: string; art: ReactNode; tint: string }[] = [
  {
    title: "Every campus event, one feed",
    body: "Talks, fests, club nights and student meetups from the mails you never read, sorted by day.",
    art: <FeedMini />,
    tint: "bg-thread-tint",
  },
  {
    title: "See who's going before you go",
    body: "Tap Interested or Going. Everyone sees the count, and people who share it can see each other.",
    art: <GoingMini />,
    tint: "bg-marigold-tint",
  },
  {
    title: "Host your own plan",
    body: "Badminton at 6, a study group, a chai run. Set the spots, and let people join or ask first.",
    art: <HostMini />,
    tint: "bg-river-tint",
  },
  {
    title: "Find friends on the live map",
    body: "Share where you are only when you want to. It switches off by itself, and blocked people never see you.",
    art: <MapMini />,
    tint: "bg-rose-tint",
  },
  {
    title: "Built for IITGN, and only IITGN",
    body: "No outsiders, no public profiles, no follower counts. Just students on the same campus.",
    art: <SafetyMini />,
    tint: "bg-[#e6e8ef]",
  },
];

const STEPS = [
  { title: "Sign in with your college email", body: "We email you a link. No passwords to remember." },
  { title: "Set up your profile", body: "Your name, batch and a few interests. About a minute." },
  { title: "Tap Going, and show up", body: "See who else is coming, connect, and go together." },
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
      <main className="mx-auto max-w-md px-5 pt-6 pb-10 lg:grid lg:max-w-5xl lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-14 lg:pt-10">
        <header className="flex items-center justify-between lg:col-span-2">
          <Logo />
          <span className="rounded-full bg-card px-3 py-1.5 text-[12px] font-semibold text-soft">IIT Gandhinagar</span>
        </header>

        <div className="lg:order-2">
          <div className="mt-8 lg:mt-0">
            <HeroScene />
          </div>
        </div>

        <div className="lg:order-1">
          <h1 className="font-display mt-8 text-[44px] leading-[0.95] font-extrabold sm:text-[54px] lg:mt-0">
            Know what&apos;s on.
            <br />
            Meet who&apos;s going.
          </h1>
          <p className="mt-4 max-w-[34ch] text-[17px] leading-relaxed text-soft">
            Every event on campus, the people going to it, and an easy way to go together.
          </p>

          {error && ERRORS[error] && (
            <p role="alert" className="mt-5 rounded-2xl bg-warn/10 p-4 text-sm font-medium text-warn">
              {ERRORS[error]}
            </p>
          )}

          <div id="join" className="mt-7 rounded-[28px] bg-card p-5 shadow-[0_20px_50px_-30px_rgba(23,20,43,0.45)]">
            <SignInForm />
          </div>
        </div>
      </main>

      <section aria-labelledby="what-h" className="mx-auto max-w-md px-5 pb-6 lg:max-w-5xl">
        <h2 id="what-h" className="font-display text-[30px] leading-tight font-extrabold">
          What you can do on KNOT
        </h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {FEATURES.map((f, i) => (
            <article key={f.title} className={`min-w-0 rounded-[30px] p-5 ${f.tint} ${i === FEATURES.length - 1 ? "lg:col-span-2" : ""}`}>
              <h3 className="font-display text-[22px] leading-tight font-bold">{f.title}</h3>
              <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-soft">{f.body}</p>
              <div className="mt-4">{f.art}</div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-h" className="mx-auto max-w-md px-5 py-8 lg:max-w-5xl">
        <h2 id="how-h" className="font-display text-[30px] leading-tight font-extrabold">
          Three steps in
        </h2>
        <ol className="mt-5 grid gap-3 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-[24px] bg-card p-5">
              <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-[18px] font-extrabold text-white">
                {i + 1}
              </span>
              <span>
                <span className="block font-bold">{s.title}</span>
                <span className="text-[14px] text-muted">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <a
          href="#join"
          className="mt-6 flex h-13 min-h-12 items-center justify-center rounded-full bg-thread text-[15px] font-bold text-white hover:bg-thread-deep"
        >
          Join with your college email
        </a>
      </section>

      <footer className="mx-auto max-w-md px-5 pt-2 pb-10 text-center text-[12px] text-muted lg:max-w-5xl">
        An independent student project. Not affiliated with IIT Gandhinagar.
      </footer>
    </div>
  );
}
