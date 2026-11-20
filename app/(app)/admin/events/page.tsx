import { requireAdmin } from "@/lib/auth";
import { loadAdminEvents } from "@/features/admin/queries";
import { EventsView } from "@/features/admin/views";

export default async function AdminEvents() {
  const { supabase } = await requireAdmin();
  return <EventsView rows={await loadAdminEvents(supabase)} />;
}
