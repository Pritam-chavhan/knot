import { requireAdmin } from "@/lib/auth";
import { loadPeople } from "@/features/admin/queries";
import { PeopleView } from "@/features/admin/views";

export default async function AdminPeople({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { supabase, user, profile } = await requireAdmin();
  const { q, page } = await searchParams;
  const query = q?.trim().slice(0, 80) || null;
  const p = Math.max(0, Math.min(1000, Number(page) || 0));
  const { rows, hasMore } = await loadPeople(supabase, query, p);
  return <PeopleView rows={rows} q={query} page={p} hasMore={hasMore} meId={user.id} meIsFounder={!!profile.is_founder} />;
}
