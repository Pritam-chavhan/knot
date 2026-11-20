import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Avatar, KnotMark } from "@/components/ui";

export default async function Discover() {
  const { profile } = await requireMember();
  const name = profile.display_name ?? "there";
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date());
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="px-5 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-muted">{today}</p>
          <h1 className="font-display mt-0.5 text-[30px] leading-[1.05] font-extrabold">
            {greeting}, {name.split(" ")[0]}
          </h1>
        </div>
        <Link href="/profile" aria-label="Your profile">
          <Avatar name={name} size={46} />
        </Link>
      </header>

      {profile.role === "admin" && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-white">
          <span className="h-2 w-2 rounded-full bg-marigold" aria-hidden="true" />
          You&apos;re an admin
        </p>
      )}

      <section className="relative mt-6 overflow-hidden rounded-[30px] bg-thread p-6 text-white">
        <KnotMark size={120} className="absolute -right-6 -bottom-8 text-white/15" />
        <h2 className="font-display relative text-[26px] leading-[1.05] font-extrabold">The event feed opens here soon</h2>
        <p className="relative mt-2 max-w-[30ch] text-[15px] leading-relaxed text-white/85">
          Talks, club nights and student plans will show up here, along with how many people are going.
        </p>
      </section>

      <h2 className="font-display mt-8 text-[20px] font-extrabold">Coming next</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {[
          { t: "Say you're going", d: "and see who else is", c: "bg-marigold-tint" },
          { t: "Host a plan", d: "match, study group, chai", c: "bg-river-tint" },
          { t: "Connect and chat", d: "with people going too", c: "bg-thread-tint" },
          { t: "Live map", d: "find friends nearby", c: "bg-rose-tint" },
        ].map((x) => (
          <li key={x.t} className={`rounded-[24px] p-4 ${x.c}`}>
            <p className="font-display text-[17px] leading-tight font-bold">{x.t}</p>
            <p className="mt-1 text-[13px] text-soft">{x.d}</p>
          </li>
        ))}
      </ul>

      <Link
        href="/welcome"
        className="mt-4 mb-6 flex items-center justify-between rounded-[24px] bg-card px-5 py-4 hover:bg-white/70"
      >
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
