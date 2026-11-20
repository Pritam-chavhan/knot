import { requireAdmin } from "@/lib/auth";
import { loadStats } from "@/features/admin/queries";
import { OverviewView } from "@/features/admin/views";

export default async function AdminOverview() {
  const { supabase } = await requireAdmin();
  return <OverviewView s={await loadStats(supabase)} />;
}
