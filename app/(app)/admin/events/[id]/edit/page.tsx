import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { AdminEventForm } from "@/features/events/forms";
import { toIstLocalInput } from "@/lib/time";

export const metadata = { title: "Edit event" };

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireAdmin();
  const { data: e } = await supabase
    .from("events")
    .select("id, source_type, title, category, starts_at, ends_at, venue, organiser, description, registration_url, source_announcement_id, status, review_status")
    .eq("id", id)
    .neq("source_type", "student_hosted")
    .maybeSingle();
  if (!e) notFound();
  const { data: mail } = e.source_announcement_id
    ? await supabase.from("source_announcements").select("from_address, subject, raw_text").eq("id", e.source_announcement_id).maybeSingle()
    : { data: null };

  const start = new Date(e.starts_at);
  const minutes = e.ends_at ? Math.round((new Date(e.ends_at).getTime() - start.getTime()) / 60000) : null;
  const duration = minutes && minutes >= 15 && minutes <= 24 * 60 ? minutes : null;

  if (e.status === "cancelled" || e.review_status === "rejected") {
    return (
      <section className="mt-6 mb-8 rounded-[28px] bg-card p-5">
        <h2 className="font-display text-[20px] font-extrabold">This event can&apos;t be edited</h2>
        <p className="mt-1 text-[14px] text-soft">It was {e.status === "cancelled" ? "cancelled" : "discarded"}. Restore it from the Events tab first if that was a mistake.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="edit-h" className="mt-6 mb-8">
      <h2 id="edit-h" className="font-display text-[20px] font-extrabold">
        Check and publish
      </h2>
      <p className="mt-1 mb-4 text-[14px] text-soft">Fix anything the AI got wrong. Saving publishes it to Discover.</p>
      <AdminEventForm
        eventId={e.id}
        initial={{
          source: e.source_type,
          title: e.title,
          category: e.category,
          startsAt: toIstLocalInput(start),
          durationMinutes: duration ? String(duration) : "",
          venue: e.venue ?? "",
          organiser: e.organiser ?? "",
          description: e.description ?? "",
          registrationUrl: e.registration_url ?? "",
        }}
      />
      {mail?.raw_text && (
        <details className="mt-4 rounded-[28px] bg-card p-5">
          <summary className="min-h-11 cursor-pointer font-bold">Original mail</summary>
          <p className="mt-2 text-[13px] text-muted">
            {mail.from_address}
            <br />
            {mail.subject}
          </p>
          <pre className="mt-3 max-h-[420px] overflow-auto rounded-2xl bg-paper p-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-soft">{mail.raw_text}</pre>
        </details>
      )}
    </section>
  );
}
