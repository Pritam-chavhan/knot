import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Person } from "@/features/events/queries";

type EventLite = { id: string; title: string; starts_at: string; venue: string | null };
const one = <T,>(v: T | T[]) => (Array.isArray(v) ? v[0] : v);

export type ReviewItem = { id: string; note: string | null; created_at: string; event: EventLite; person: Person };
export type MyRequest = { id: string; status: "pending" | "accepted" | "declined"; updated_at: string; event: EventLite };
export type SoonItem = { event: EventLite };

// Requests from other students waiting on plans you host. Drives the badge.
export async function countToReview(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from("event_join_requests")
    .select("id, events!inner(host_id), profiles!inner(id)", { count: "exact", head: true })
    .eq("events.host_id", userId)
    .eq("status", "pending")
    .gte("events.starts_at", new Date().toISOString())
    .in("events.status", ["published", "full"]);
  return count ?? 0;
}

export async function loadActivity(supabase: SupabaseClient, userId: string) {
  const now = Date.now();
  const since = new Date(now - 24 * 3600_000).toISOString();
  const soonEnd = new Date(now + 24 * 3600_000).toISOString();
  const [review, mine, soon] = await Promise.all([
    supabase
      .from("event_join_requests")
      .select("id, note, created_at, events!inner(id, title, starts_at, venue, host_id), profiles!inner(id, display_name, programme, batch_year, avatar_path)")
      .eq("events.host_id", userId)
      .eq("status", "pending")
      .gte("events.starts_at", new Date(now).toISOString())
      .in("events.status", ["published", "full"])
      .order("created_at")
      .limit(50),
    supabase
      .from("event_join_requests")
      .select("id, status, updated_at, events!inner(id, title, starts_at, venue)")
      .eq("profile_id", userId)
      .in("status", ["pending", "accepted", "declined"])
      .gte("events.starts_at", since)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("event_participation")
      .select("events!inner(id, title, starts_at, venue, status)")
      .eq("profile_id", userId)
      .eq("state", "going")
      .gte("events.starts_at", new Date(now).toISOString())
      .lte("events.starts_at", soonEnd)
      .in("events.status", ["published", "full"])
      .limit(10),
  ]);

  type Raw = Record<string, unknown> & { events: EventLite | EventLite[]; profiles?: Person | Person[] };
  return {
    review: ((review.data ?? []) as Raw[]).map((r) => ({
      id: r.id as string,
      note: (r.note as string | null) ?? null,
      created_at: r.created_at as string,
      event: one(r.events),
      person: one(r.profiles!),
    })) as ReviewItem[],
    mine: ((mine.data ?? []) as Raw[]).map((r) => ({
      id: r.id as string,
      status: r.status as MyRequest["status"],
      updated_at: r.updated_at as string,
      event: one(r.events),
    })) as MyRequest[],
    soon: ((soon.data ?? []) as Raw[])
      .map((r) => ({ event: one(r.events) }))
      .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at)) as SoonItem[],
  };
}
