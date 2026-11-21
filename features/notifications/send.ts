import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/push";

// Every lookup here runs as the signed-in student, so row-level security
// decides what they can point a notification at. Who gets notified always
// comes from the database, never from the form. Sending happens after the
// response, so it never slows down the tap.

type Me = { id: string; name: string };
const first = (name: string | null | undefined) => (name?.trim() || "Someone").split(" ")[0];

export async function notifyConnectionRequest(supabase: SupabaseClient, me: Me, to: string) {
  const { data } = await supabase
    .from("connection_requests")
    .select("id, updated_at")
    .eq("from_id", me.id)
    .eq("to_id", to)
    .eq("status", "pending")
    .maybeSingle<{ id: string; updated_at: string }>();
  if (!data) return;
  after(() => notify(to, `request:${data.id}:${data.updated_at}`, { title: `${me.name} wants to connect`, body: "Open Chats to accept or decline.", url: "/chats", tag: "requests" }));
}

export async function notifyConnected(supabase: SupabaseClient, me: Me, connectionId: string) {
  const { data } = await supabase.from("connections").select("profile_a, profile_b").eq("id", connectionId).maybeSingle<{ profile_a: string; profile_b: string }>();
  if (!data) return;
  const other = data.profile_a === me.id ? data.profile_b : data.profile_a;
  after(() =>
    notify(other, `connected:${connectionId}`, { title: `${me.name} accepted your request`, body: `You can chat with ${first(me.name)} now.`, url: `/chats/${connectionId}`, tag: `chat-${connectionId}` }),
  );
}

export async function notifyMessage(supabase: SupabaseClient, me: Me, messageId: string) {
  const { data: m } = await supabase
    .from("messages")
    .select("id, connection_id")
    .eq("id", messageId)
    .eq("sender_id", me.id)
    .maybeSingle<{ id: string; connection_id: string }>();
  if (!m) return;
  const { data: c } = await supabase.from("connections").select("profile_a, profile_b").eq("id", m.connection_id).maybeSingle<{ profile_a: string; profile_b: string }>();
  if (!c) return;
  const other = c.profile_a === me.id ? c.profile_b : c.profile_a;
  // Only who it's from, never the text, so nothing private shows on a lock screen.
  after(() => notify(other, `message:${m.id}`, { title: me.name, body: "Sent you a message", url: `/chats/${m.connection_id}`, tag: `chat-${m.connection_id}` }));
}

export async function notifyWave(supabase: SupabaseClient, me: Me, to: string) {
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data } = await supabase
    .from("waves")
    .select("id")
    .eq("from_id", me.id)
    .eq("to_id", to)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!data) return;
  after(() => notify(to, `wave:${data.id}`, { title: `${me.name} waved at you 👋`, body: "Open the map to see where they are.", url: "/map", tag: `wave-${me.id}` }));
}

export async function notifyJoinRequest(supabase: SupabaseClient, me: Me, eventId: string) {
  const [{ data: req }, { data: ev }] = await Promise.all([
    supabase
      .from("event_join_requests")
      .select("id, updated_at")
      .eq("event_id", eventId)
      .eq("profile_id", me.id)
      .eq("status", "pending")
      .maybeSingle<{ id: string; updated_at: string }>(),
    supabase.from("events").select("host_id, title").eq("id", eventId).maybeSingle<{ host_id: string | null; title: string }>(),
  ]);
  if (!req || !ev?.host_id || ev.host_id === me.id) return;
  const host = ev.host_id;
  after(() => notify(host, `join:${req.id}:${req.updated_at}`, { title: `${me.name} wants to join`, body: ev.title, url: `/events/${eventId}`, tag: `join-${eventId}` }));
}

export async function notifyJoinAccepted(supabase: SupabaseClient, me: Me, requestId: string) {
  const { data: req } = await supabase
    .from("event_join_requests")
    .select("id, profile_id, event_id, status, updated_at")
    .eq("id", requestId)
    .maybeSingle<{ id: string; profile_id: string; event_id: string; status: string; updated_at: string }>();
  if (!req || req.status !== "accepted") return;
  const { data: ev } = await supabase.from("events").select("title, host_id").eq("id", req.event_id).maybeSingle<{ title: string; host_id: string | null }>();
  if (!ev || ev.host_id !== me.id) return;
  after(() =>
    notify(req.profile_id, `joined:${req.id}:${req.updated_at}`, { title: `You're in: ${ev.title}`, body: `${first(me.name)} accepted your request.`, url: `/events/${req.event_id}`, tag: `join-${req.event_id}` }),
  );
}
