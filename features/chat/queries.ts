import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countToReview } from "@/features/activity/queries";

export type ChatRow = {
  connection_id: string;
  other_id: string;
  display_name: string | null;
  avatar_path: string | null;
  last_body: string | null;
  last_from_me: boolean | null;
  last_at: string;
  unread: number;
};

export type ConnectionRequest = {
  request_id: string;
  from_id: string;
  display_name: string | null;
  programme: string | null;
  batch_year: number | null;
  avatar_path: string | null;
  note: string | null;
  created_at: string;
};

export type Relationship =
  | { state: "self" | "unavailable" | "requested" | "none" | "closed" }
  | { state: "connected"; connection_id: string }
  | { state: "incoming"; request_id: string };

export type ThreadMessage = { id: string; sender_id: string; body: string; created_at: string };

export async function loadChats(supabase: SupabaseClient, userId: string) {
  const [chats, requests, planRequests] = await Promise.all([
    supabase.rpc("my_chats"),
    supabase.rpc("my_connection_requests"),
    countToReview(supabase, userId),
  ]);
  return {
    chats: (chats.data ?? []) as ChatRow[],
    requests: (requests.data ?? []) as ConnectionRequest[],
    planRequests,
  };
}

// The number on the Chats tab: unread chats, connection requests and
// requests to join your plans.
export async function chatsBadge(supabase: SupabaseClient, userId: string) {
  const [badge, plans] = await Promise.all([supabase.rpc("chat_badge"), countToReview(supabase, userId)]);
  const b = (badge.data ?? {}) as { unread_chats?: number; requests?: number };
  return (b.unread_chats ?? 0) + (b.requests ?? 0) + plans;
}

export async function loadRelationship(supabase: SupabaseClient, otherId: string): Promise<Relationship> {
  const { data } = await supabase.rpc("relationship_with", { p_other: otherId });
  return (data ?? { state: "unavailable" }) as Relationship;
}

// Row-level security does the checking: a chat you're not in, or with
// someone blocked or suspended, simply isn't found.
export async function loadThread(supabase: SupabaseClient, connectionId: string, userId: string) {
  const { data: c } = await supabase
    .from("connections")
    .select("id, profile_a, profile_b")
    .eq("id", connectionId)
    .maybeSingle<{ id: string; profile_a: string; profile_b: string }>();
  if (!c) return null;
  const otherId = c.profile_a === userId ? c.profile_b : c.profile_a;
  const [{ data: other }, { data: messages }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, programme, batch_year, avatar_path")
      .eq("id", otherId)
      .maybeSingle<{ id: string; display_name: string | null; programme: string | null; batch_year: number | null; avatar_path: string | null }>(),
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("connection_id", c.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (!other) return null;
  await supabase.rpc("mark_chat_read", { p_connection: c.id });
  return { connectionId: c.id, other, messages: ((messages ?? []) as ThreadMessage[]).reverse() };
}

export async function loadBlocks(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("my_blocks");
  return (data ?? []) as { profile_id: string; display_name: string | null; blocked_at: string }[];
}
