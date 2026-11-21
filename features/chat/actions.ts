"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { chatError, REPORT_REASONS } from "./errors";
import { notifyConnected, notifyConnectionRequest } from "@/features/notifications/send";

export type ChatActionState = { error?: string; ok?: string };

const uuid = z.string().uuid();
const AGAIN = { error: "That didn't work. Reload and try again." };

function refreshPerson(id: string) {
  revalidatePath(`/people/${id}`);
  revalidatePath("/chats");
  revalidatePath("/", "layout");
}

export async function sendConnectionRequest(_prev: ChatActionState, fd: FormData): Promise<ChatActionState> {
  const { supabase, profile } = await requireMember();
  const to = uuid.safeParse(fd.get("to"));
  if (!to.success) return AGAIN;
  const note = String(fd.get("note") ?? "").trim();
  if (note.length > 140) return { error: "Keep your note under 140 characters." };
  const { data, error } = await supabase.rpc("send_connection_request", { p_to: to.data, p_note: note || null });
  if (error) return { error: chatError(error) };
  const result = data as { state: string; connection_id?: string };
  const me = { id: profile.id, name: profile.display_name?.trim() || "Someone at IITGN" };
  if (result.state === "connected" && result.connection_id) await notifyConnected(supabase, me, result.connection_id);
  else await notifyConnectionRequest(supabase, me, to.data);
  refreshPerson(to.data);
  return { ok: result.state };
}

export async function cancelConnectionRequest(_prev: ChatActionState, fd: FormData): Promise<ChatActionState> {
  const { supabase } = await requireMember();
  const to = uuid.safeParse(fd.get("to"));
  if (!to.success) return AGAIN;
  const { error } = await supabase.rpc("cancel_connection_request", { p_to: to.data });
  if (error) return { error: chatError(error) };
  refreshPerson(to.data);
  return { ok: "cancelled" };
}

export async function respondConnectionRequest(_prev: ChatActionState, fd: FormData): Promise<ChatActionState> {
  const { supabase, profile } = await requireMember();
  const request = uuid.safeParse(fd.get("request"));
  const from = uuid.safeParse(fd.get("from"));
  const accept = fd.get("accept") === "1";
  if (!request.success || !from.success) return AGAIN;
  const { data, error } = await supabase.rpc("respond_connection_request", { p_request: request.data, p_accept: accept });
  if (error) return { error: chatError(error) };
  refreshPerson(from.data);
  const result = data as { state: string; connection_id?: string };
  if (result.connection_id) await notifyConnected(supabase, { id: profile.id, name: profile.display_name?.trim() || "Someone at IITGN" }, result.connection_id);
  if (result.connection_id && fd.get("open") === "1") redirect(`/chats/${result.connection_id}`);
  return { ok: result.state };
}

export async function removeConnection(_prev: ChatActionState, fd: FormData): Promise<ChatActionState> {
  const { supabase } = await requireMember();
  const other = uuid.safeParse(fd.get("person"));
  if (!other.success) return AGAIN;
  const { error } = await supabase.rpc("remove_connection", { p_other: other.data });
  if (error) return { error: chatError(error) };
  refreshPerson(other.data);
  redirect("/chats");
}

const AFTER_BLOCK = new Set(["/chats", "/discover"]);

export async function blockPerson(_prev: ChatActionState, fd: FormData): Promise<ChatActionState> {
  const { supabase } = await requireMember();
  const other = uuid.safeParse(fd.get("person"));
  if (!other.success) return AGAIN;
  const { error } = await supabase.rpc("block_profile", { p_other: other.data });
  if (error) return { error: chatError(error) };
  revalidatePath("/", "layout");
  const then = String(fd.get("then") ?? "");
  redirect(AFTER_BLOCK.has(then) ? then : "/discover");
}

export async function unblockPerson(_prev: ChatActionState, fd: FormData): Promise<ChatActionState> {
  const { supabase } = await requireMember();
  const other = uuid.safeParse(fd.get("person"));
  if (!other.success) return AGAIN;
  const { error } = await supabase.rpc("unblock_profile", { p_other: other.data });
  if (error) return { error: chatError(error) };
  revalidatePath("/", "layout");
  return { ok: "unblocked" };
}

const reportSchema = z.object({
  type: z.enum(["profile", "message", "event"]),
  target: z.string().uuid(),
  reason: z.enum(REPORT_REASONS.map((r) => r.id) as [string, ...string[]]),
  details: z.string().trim().max(1000).optional(),
});

export async function fileReport(_prev: ChatActionState, fd: FormData): Promise<ChatActionState> {
  const { supabase } = await requireMember();
  const parsed = reportSchema.safeParse({
    type: fd.get("type"),
    target: fd.get("target"),
    reason: fd.get("reason") ?? undefined,
    details: fd.get("details") ?? undefined,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "reason") return { error: "Pick what's wrong." };
    if (field === "details") return { error: "Keep the details under 1,000 characters." };
    return AGAIN;
  }
  const { type, target, reason, details } = parsed.data;
  const { error } = await supabase.rpc("file_report", { p_type: type, p_target: target, p_reason: reason, p_details: details || null });
  if (error) return { error: chatError(error) };

  const person = uuid.safeParse(fd.get("blockPerson"));
  if (fd.get("alsoBlock") === "on" && person.success) {
    const { error: blockError } = await supabase.rpc("block_profile", { p_other: person.data });
    if (blockError) return { error: chatError(blockError) };
    revalidatePath("/", "layout");
    return { ok: "reported_blocked" };
  }
  return { ok: "reported" };
}
