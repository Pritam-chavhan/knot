import { requireAdmin } from "@/lib/auth";
import { AdminEventForm } from "@/features/events/forms";

export const metadata = { title: "Add an event" };

export default async function AdminEventNew() {
  await requireAdmin();
  return (
    <section aria-labelledby="add-h" className="mt-6 mb-8">
      <h2 id="add-h" className="font-display text-[20px] font-extrabold">Add an event</h2>
      <p className="mt-1 mb-4 text-[14px] text-soft">Institute and club events, tagged Campus. It shows up on Discover right away.</p>
      <AdminEventForm />
    </section>
  );
}
