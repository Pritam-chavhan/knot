import { requireAdmin } from "@/lib/auth";
import { loadInbox } from "@/features/admin/queries";
import { InboxView } from "@/features/admin/inbox-view";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { supabase } = await requireAdmin();
  const [{ rows, stats }, sp] = await Promise.all([loadInbox(supabase), searchParams]);
  return <InboxView rows={rows} stats={stats} saved={sp.saved === "1"} />;
}
