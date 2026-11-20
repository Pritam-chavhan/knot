import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PersonProfile = {
  id: string;
  display_name: string | null;
  programme: string | null;
  batch_year: number | null;
  bio: string | null;
  avatar_path: string | null;
  github: string | null;
  instagram: string | null;
  linkedin: string | null;
  onboarded_at: string | null;
};

export type PlanRow = { id: string; title: string; starts_at: string; venue: string | null; status: string };

type InterestRow = { interest_id: number; interests: { name: string } | { name: string }[] };
const one = <T,>(v: T | T[]) => (Array.isArray(v) ? v[0] : v);

// Everything here goes through row-level security: a blocked or suspended
// student simply isn't found, and only plans they've made visible show up.
export async function loadPerson(supabase: SupabaseClient, id: string, viewerId: string) {
  const { data: person } = await supabase
    .from("profiles")
    .select("id, display_name, programme, batch_year, bio, avatar_path, github, instagram, linkedin, onboarded_at")
    .eq("id", id)
    .maybeSingle<PersonProfile>();
  if (!person || !person.onboarded_at) return null;

  const now = new Date().toISOString();
  const [interests, mine, hosting, going] = await Promise.all([
    supabase.from("profile_interests").select("interest_id, interests!inner(name)").eq("profile_id", id),
    supabase.from("profile_interests").select("interest_id").eq("profile_id", viewerId),
    supabase
      .from("events")
      .select("id, title, starts_at, venue, status")
      .eq("host_id", id)
      .in("status", ["published", "full"])
      .eq("review_status", "approved")
      .gte("starts_at", now)
      .order("starts_at")
      .limit(10),
    supabase
      .from("event_participation")
      .select("events!inner(id, title, starts_at, venue, status, host_id)")
      .eq("profile_id", id)
      .eq("state", "going")
      .eq("is_visible", true)
      .gte("events.starts_at", now)
      .in("events.status", ["published", "full"])
      .eq("events.review_status", "approved")
      .limit(20),
  ]);

  const myIds = new Set((mine.data ?? []).map((r) => r.interest_id as number));
  const hostingRows = (hosting.data ?? []) as PlanRow[];
  const hostingIds = new Set(hostingRows.map((e) => e.id));
  const goingRows = ((going.data ?? []) as { events: (PlanRow & { host_id: string | null }) | (PlanRow & { host_id: string | null })[] }[])
    .map((r) => one(r.events))
    .filter((e) => e && !hostingIds.has(e.id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 10);

  return {
    person,
    isMe: id === viewerId,
    interests: ((interests.data ?? []) as InterestRow[])
      .map((r) => ({ id: r.interest_id, name: one(r.interests).name, shared: myIds.has(r.interest_id) && id !== viewerId }))
      .sort((a, b) => Number(b.shared) - Number(a.shared) || a.name.localeCompare(b.name)),
    hosting: hostingRows,
    going: goingRows,
  };
}
