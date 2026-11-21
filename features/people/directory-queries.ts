import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avatarSrc } from "@/lib/avatar";

export type PersonCardData = {
  id: string;
  name: string;
  programme: string | null;
  batch: number | null;
  avatar: string | null;
  bio: string | null;
  sharedInterests: string[];
  mutual: number;
  sharedPlans: number;
  state: "none" | "requested" | "incoming" | "connected" | "closed" | "unavailable";
};

type Row = {
  id: string;
  display_name: string | null;
  programme: string | null;
  batch_year: number | null;
  avatar_path: string | null;
  bio: string | null;
  shared_interests: string[] | null;
  mutual_connections: number;
  shared_plans: number;
  state: PersonCardData["state"];
};

// Suggestions when `query` is empty, search results otherwise. The database
// decides who you can see (same college, not blocked, set up).
export async function loadPeople(supabase: SupabaseClient, query: string | null, limit = 30): Promise<PersonCardData[]> {
  const { data, error } = await supabase.rpc("people_directory", { p_query: query, p_limit: limit });
  if (error) return [];
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    name: r.display_name?.trim() || "Someone at IITGN",
    programme: r.programme,
    batch: r.batch_year,
    avatar: avatarSrc(r.id, r.avatar_path),
    bio: r.bio,
    sharedInterests: r.shared_interests ?? [],
    mutual: Number(r.mutual_connections) || 0,
    sharedPlans: Number(r.shared_plans) || 0,
    state: r.state,
  }));
}

export async function peopleCount(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.rpc("people_count");
  return typeof data === "number" ? data : 0;
}
