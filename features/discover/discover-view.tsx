import Link from "next/link";
import type { Profile } from "@/lib/auth";
import { DayTimeline } from "@/components/art";
import { Avatar, KnotMark } from "@/components/ui";

const ON_THE_WAY = [
  { title: "Say you're going", body: "and see who else is" },
  { title: "Host your own plan", body: "a match, a study group, a chai run" },
  { title: "Connect and chat", body: "with people going to the same thing" },
  { title: "Live map", body: "wave at friends nearby" },
];

export function DiscoverView({ profile, now = new Date() }: { profile: Pick<Profile, "display_name" | "role">; now?: Date }) {
  const name = profile.display_name ?? "there";
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(now);
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  const greeting = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="px-5 pt-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted">{today}</p>
          <h1 className="font-display mt-0.5 text-[30px] leading-[1.05] font-extrabold">
            {greeting}, {name.split(" ")[0]}
          </h1>
        </div>
        <Link href="/profile" className="shrink-0 rounded-full">
          <span className="sr-only">Your profile</span>
          <Avatar name={name} size={46} />
        </Link>
      </header>

      {profile.role === "admin" && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-white">
          <span className="h-2 w-2 rounded-full bg-marigold" aria-hidden="true" />
          You&apos;re an admin
        </p>
      )}

      <section className="relative mt-6 overflow-hidden rounded-[30px] bg-thread px-5 pt-6 pb-5 text-white" aria-labelledby="feed-h">
        <KnotMark size={110} className="pointer-events-none absolute -top-6 -right-7 text-white/12" />
        <h2 id="feed-h" className="font-display relative max-w-[15ch] text-[26px] leading-[1.05] font-extrabold">
          Your feed starts filling up this week
        </h2>
        <p className="relative mt-2 max-w-[32ch] text-[15px] leading-relaxed text-white/85">
          Talks, club nights and student plans will appear here with how many people are going. Here&apos;s a preview.
        </p>
        <div className="relative mt-5 rounded-[24px] bg-thread-tint p-3 text-ink">
          <p className="mb-2 px-1 text-[12px] font-bold text-thread-deep">Example</p>
          <DayTimeline compact />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="next-h">
        <h2 id="next-h" className="font-display text-[20px] font-extrabold">
          On the way
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-[24px] bg-card">
          {ON_THE_WAY.map((x) => (
            <li key={x.title} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <span className="min-w-0">
                <span className="block font-bold">{x.title}</span>
                <span className="text-[13px] text-muted">{x.body}</span>
              </span>
              <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[12px] font-bold text-soft">Soon</span>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/welcome" className="mt-4 mb-6 flex min-h-14 items-center justify-between rounded-[24px] bg-card px-5 py-4 hover:bg-white/70">
        <span>
          <span className="block font-bold">How KNOT works</span>
          <span className="text-[13px] text-muted">Take the one-minute tour again</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </main>
  );
}
