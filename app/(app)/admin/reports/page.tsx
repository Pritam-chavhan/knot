import { requireAdmin } from "@/lib/auth";
import { loadReports } from "@/features/admin/queries";
import { ReportsView } from "@/features/admin/reports-view";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { supabase } = await requireAdmin();
  const open = (await searchParams).view !== "closed";
  const rows = await loadReports(supabase, open);
  return <ReportsView rows={rows} open={open} />;
}
