import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { HostForm } from "@/features/events/forms";

export const metadata = { title: "Host a plan" };

export default async function HostNew() {
  await requireMember();
  return (
    <main className="px-5 pt-5 pb-8">
      <Link href="/discover" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[14px] font-bold text-soft hover:text-ink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Discover
      </Link>
      <div className="mt-2 mb-5 rounded-[30px] bg-river-deep px-5 pt-6 pb-6 text-white">
        <h1 className="font-display text-[32px] leading-[1.02] font-extrabold">Host a plan</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/85">A match, a study group, a chai run. Post it and people can join you.</p>
      </div>
      <HostForm />
    </main>
  );
}
