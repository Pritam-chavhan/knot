import { requireMember } from "@/lib/auth";
import { DiscoverView } from "@/features/discover/discover-view";
import { CATEGORY_IDS } from "@/features/events/categories";
import { loadFeed } from "@/features/events/queries";

export default async function Discover({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { supabase, profile } = await requireMember();
  const { c } = await searchParams;
  const category = c && (CATEGORY_IDS as readonly string[]).includes(c) ? c : null;
  const events = await loadFeed(supabase);
  return <DiscoverView profile={profile} events={events} category={category} />;
}
