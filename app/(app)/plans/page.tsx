import { requireMember } from "@/lib/auth";
import { loadFeed } from "@/features/events/queries";
import { PLAN_FILTERS, PlansView, type PlanFilter } from "@/features/plans/plans-view";

export const metadata = { title: "My plans" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filter: PlanFilter = PLAN_FILTERS.some((x) => x.id === f) ? (f as PlanFilter) : "all";
  const { supabase, user } = await requireMember();
  const events = await loadFeed(supabase);
  return <PlansView events={events} userId={user.id} filter={filter} />;
}
