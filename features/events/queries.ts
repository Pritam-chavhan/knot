import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FeedEvent = {
  id: string;
  title: string;
  category: string;
  source_type: "official" | "community" | "student_hosted";
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  organiser: string | null;
  status: "published" | "full" | "cancelled";
  join_mode: "none" | "open" | "request";
  capacity: number | null;
  host_id: string | null;
  host_name: string | null;
  interested: number;
  going: number;
  my_state: "interested" | "going" | null;
  going_names: string[];
};

export async function loadFeed(supabase: SupabaseClient): Promise<FeedEvent[]> {
  const { data, error } = await supabase.rpc("event_feed", { p_limit: 150 });
  if (error) throw new Error("feed_failed");
  return (data ?? []).map((r: FeedEvent) => ({ ...r, interested: Number(r.interested), going: Number(r.going) }));
}

export type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  source_type: FeedEvent["source_type"];
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  organiser: string | null;
  registration_url: string | null;
  status: string;
  join_mode: FeedEvent["join_mode"];
  capacity: number | null;
  host_id: string | null;
};

export type Person = { id: string; display_name: string | null; programme: string | null; batch_year: number | null; avatar_path: string | null };

export async function loadEvent(supabase: SupabaseClient, eventId: string, userId: string) {
  const { data: event } = await supabase
    .from("events")
    .select("id, title, description, category, source_type, starts_at, ends_at, venue, organiser, registration_url, status, join_mode, capacity, host_id")
    .eq("id", eventId)
    .maybeSingle<EventDetail>();
  if (!event) return null;

  const isHost = event.host_id === userId;
  const [counts, mine, going, host, myRequest, requests] = await Promise.all([
    supabase.rpc("event_counts", { p_event_id: eventId }),
    supabase.from("event_participation").select("state, is_visible").eq("event_id", eventId).eq("profile_id", userId).maybeSingle(),
    supabase
      .from("event_participation")
      .select("profile_id, profiles!inner(id, display_name, programme, batch_year, avatar_path)")
      .eq("event_id", eventId)
      .eq("state", "going")
      .eq("is_visible", true)
      .order("created_at")
      .limit(100),
    event.host_id
      ? supabase.from("profiles").select("id, display_name, programme, batch_year, avatar_path").eq("id", event.host_id).maybeSingle<Person>()
      : Promise.resolve({ data: null }),
    event.join_mode === "request" && !isHost
      ? supabase.from("event_join_requests").select("status").eq("event_id", eventId).eq("profile_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    isHost && event.join_mode === "request"
      ? supabase
          .from("event_join_requests")
          .select("id, note, created_at, profiles!inner(id, display_name, programme, batch_year, avatar_path)")
          .eq("event_id", eventId)
          .eq("status", "pending")
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);

  const c = (counts.data as { interested: number; going: number }[] | null)?.[0];
  type WithProfile = { profiles: Person | Person[] };
  const one = (p: Person | Person[]) => (Array.isArray(p) ? p[0] : p);

  const allVisible = ((going.data ?? []) as WithProfile[]).map((r) => one(r.profiles));
  return {
    event,
    isHost,
    visibleGoingTotal: allVisible.length,
    host: host.data as Person | null,
    counts: { interested: Number(c?.interested ?? 0), going: Number(c?.going ?? 0) },
    mine: mine.data as { state: "interested" | "going"; is_visible: boolean } | null,
    goingPeople: allVisible.filter((p) => p.id !== event.host_id),
    myRequest: (myRequest.data as { status: string } | null)?.status ?? null,
    requests: ((requests.data ?? []) as (WithProfile & { id: string; note: string | null })[]).map((r) => ({
      id: r.id,
      note: r.note,
      person: one(r.profiles),
    })),
  };
}
