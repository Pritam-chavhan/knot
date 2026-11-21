import { requireMember } from "@/lib/auth";
import { DiscoverView } from "@/features/discover/discover-view";
import { CATEGORY_IDS } from "@/features/events/categories";
import { loadFeed } from "@/features/events/queries";
import { pushPublicKey } from "@/lib/push";
import { loadPeople, peopleCount } from "@/features/people/directory-queries";

export default async function Discover({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { supabase, profile } = await requireMember();
  const { c } = await searchParams;
  const category = c && (CATEGORY_IDS as readonly string[]).includes(c) ? c : null;
  const [events, live, pushKey, people, count] = await Promise.all([
    loadFeed(supabase),
    supabase.rpc("map_live_count").then((r) => (typeof r.data === "number" ? r.data : 0)),
    pushPublicKey(),
    loadPeople(supabase, null, 4),
    peopleCount(supabase),
  ]);
  return <DiscoverView profile={profile} events={events} category={category} live={live} pushKey={pushKey} people={{ list: people, count }} />;
}
