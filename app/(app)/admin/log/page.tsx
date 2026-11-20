import { requireAdmin } from "@/lib/auth";
import { loadLog } from "@/features/admin/queries";
import { LogView } from "@/features/admin/views";

export default async function AdminLog() {
  const { supabase } = await requireAdmin();
  return <LogView rows={await loadLog(supabase)} />;
}
