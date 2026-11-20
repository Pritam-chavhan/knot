import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminEventForm } from "@/features/events/forms";

export const metadata = { title: "Add an event" };

export default async function AdminEventNew() {
  await requireAdmin();
  return (
    <main className="px-5 pt-5 pb-8">
      <Link href="/discover" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[14px] font-bold text-soft hover:text-ink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Discover
      </Link>
      <div className="mt-2 mb-5 rounded-[30px] bg-ink px-5 pt-6 pb-6 text-white">
        <h1 className="font-display text-[32px] leading-[1.02] font-extrabold">Add an event</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/80">Official and club events from campus mail. It shows up on Discover right away.</p>
      </div>
      <AdminEventForm />
    </main>
  );
}
