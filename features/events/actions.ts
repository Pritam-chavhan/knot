"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireMember } from "@/lib/auth";
import { adminEditSchema, adminEventSchema, endsAtFrom, hostEventSchema } from "./validation";
import { friendlyError } from "./errors";

export type ActionState = { error?: string; ok?: string; field?: string; values?: Record<string, string> };

const valuesOf = (fd: FormData) => Object.fromEntries([...fd].filter(([, v]) => typeof v === "string")) as Record<string, string>;

const id = z.string().uuid();

function refresh(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/", "layout");
}

export async function setParticipation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMember();
  const eventId = id.safeParse(formData.get("eventId"));
  const raw = String(formData.get("state") ?? "");
  if (!eventId.success || !["", "interested", "going"].includes(raw)) return { error: "That didn't work. Reload and try again." };
  const visibleRaw = formData.get("visible");
  const visible = visibleRaw === null ? null : visibleRaw === "on";

  const { error } = await supabase.rpc("set_my_participation", {
    p_event_id: eventId.data,
    p_state: raw === "" ? null : raw,
    p_visible: visible,
  });
  if (error) return { error: friendlyError(error) };
  refresh(eventId.data);
  return { ok: raw };
}

export async function requestToJoin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMember();
  const eventId = id.safeParse(formData.get("eventId"));
  if (!eventId.success) return { error: "That didn't work. Reload and try again." };
  const note = String(formData.get("note") ?? "").trim();
  if (note.length > 280) return { error: "Keep your note under 280 characters." };
  const { error } = await supabase.rpc("request_to_join", { p_event_id: eventId.data, p_note: note || null });
  if (error) return { error: friendlyError(error) };
  refresh(eventId.data);
  return { ok: "requested" };
}

export async function withdrawRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMember();
  const eventId = id.safeParse(formData.get("eventId"));
  if (!eventId.success) return { error: "That didn't work. Reload and try again." };
  const { error } = await supabase.rpc("withdraw_join_request", { p_event_id: eventId.data });
  if (error) return { error: friendlyError(error) };
  refresh(eventId.data);
  return { ok: "withdrawn" };
}

export async function respondToRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMember();
  const requestId = id.safeParse(formData.get("requestId"));
  const eventId = id.safeParse(formData.get("eventId"));
  if (!requestId.success || !eventId.success) return { error: "That didn't work. Reload and try again." };
  const accept = formData.get("accept") === "yes";
  const { error } = await supabase.rpc("respond_join_request", { p_request_id: requestId.data, p_accept: accept });
  if (error) return { error: friendlyError(error) };
  refresh(eventId.data);
  return { ok: accept ? "accepted" : "declined" };
}

export async function cancelEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMember();
  const eventId = id.safeParse(formData.get("eventId"));
  if (!eventId.success) return { error: "That didn't work. Reload and try again." };
  if (formData.get("confirm") !== "yes") return { error: "Tick the box to confirm." };
  const { error } = await supabase.rpc("cancel_my_event", { p_event_id: eventId.data });
  if (error) return { error: friendlyError(error, "This plan couldn't be cancelled. Reload and try again.") };
  refresh(eventId.data);
  return { ok: "cancelled" };
}

function fieldError(issues: z.core.$ZodIssue[], fd: FormData): ActionState {
  const i = issues[0];
  return { error: i.message, field: String(i.path[0] ?? ""), values: valuesOf(fd) };
}

export async function createHostedEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMember();
  const parsed = hostEventSchema.safeParse({
    title: formData.get("title") ?? "",
    category: formData.get("category") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    durationMinutes: formData.get("durationMinutes") || undefined,
    venue: formData.get("venue") ?? "",
    description: formData.get("description") ?? "",
    capacity: formData.get("capacity") ?? "",
    joinMode: formData.get("joinMode") ?? "open",
  });
  if (!parsed.success) return fieldError(parsed.error.issues, formData);
  const v = parsed.data;

  const { data: eventId, error } = await supabase.rpc("create_hosted_event", {
    p_title: v.title,
    p_category: v.category,
    p_starts_at: v.startsAt.toISOString(),
    p_ends_at: endsAtFrom(v.startsAt, v.durationMinutes)?.toISOString() ?? null,
    p_venue: v.venue,
    p_description: v.description,
    p_capacity: v.capacity,
    p_join_mode: v.joinMode,
  });
  if (error?.message.includes("rate_limited")) return { error: "You've started 5 plans today. Try again tomorrow.", values: valuesOf(formData) };
  if (error || !eventId) return { error: friendlyError(error, "Your plan didn't save. Try again in a moment."), values: valuesOf(formData) };
  revalidatePath("/", "layout");
  redirect(`/events/${eventId}?new=1`);
}

export async function createOfficialEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireAdmin();
  const parsed = adminEventSchema.safeParse({
    source: formData.get("source") ?? "official",
    title: formData.get("title") ?? "",
    category: formData.get("category") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    durationMinutes: formData.get("durationMinutes") || undefined,
    venue: formData.get("venue") ?? "",
    organiser: formData.get("organiser") ?? "",
    description: formData.get("description") ?? "",
    registrationUrl: formData.get("registrationUrl") ?? "",
  });
  if (!parsed.success) return fieldError(parsed.error.issues, formData);
  const v = parsed.data;

  const { data, error } = await supabase
    .from("events")
    .insert({
      institution_id: (await supabase.rpc("my_institution")).data,
      source_type: v.source,
      verified_by: v.source === "official" ? user.id : null,
      created_by: user.id,
      title: v.title,
      category: v.category,
      starts_at: v.startsAt.toISOString(),
      ends_at: endsAtFrom(v.startsAt, v.durationMinutes)?.toISOString() ?? null,
      venue: v.venue,
      organiser: v.organiser,
      description: v.description,
      registration_url: v.registrationUrl,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "The event didn't save. Try again in a moment.", values: valuesOf(formData) };
  revalidatePath("/", "layout");
  redirect(`/events/${data.id}?new=1`);
}

// Saves an admin's edits to an institute or club event (usually one found in
// campus mail) and publishes it, in one logged database step.
export async function updateEventAsAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const eventId = z.string().uuid().safeParse(formData.get("eventId"));
  if (!eventId.success) return { error: "That event no longer exists. Go back to the inbox.", values: valuesOf(formData) };
  const parsed = adminEditSchema.safeParse({
    source: formData.get("source") ?? "official",
    title: formData.get("title") ?? "",
    category: formData.get("category") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    durationMinutes: formData.get("durationMinutes") || undefined,
    venue: formData.get("venue") ?? "",
    organiser: formData.get("organiser") ?? "",
    description: formData.get("description") ?? "",
    registrationUrl: formData.get("registrationUrl") ?? "",
  });
  if (!parsed.success) return fieldError(parsed.error.issues, formData);
  const v = parsed.data;

  const { error } = await supabase.rpc("admin_save_event", {
    p_event: eventId.data,
    p_source: v.source,
    p_title: v.title,
    p_category: v.category,
    p_starts: v.startsAt.toISOString(),
    p_ends: endsAtFrom(v.startsAt, v.durationMinutes)?.toISOString() ?? null,
    p_venue: v.venue,
    p_organiser: v.organiser,
    p_description: v.description,
    p_url: v.registrationUrl,
  });
  if (error) {
    const msg = error.message.includes("not_editable")
      ? "This event was cancelled or discarded, so it can't be edited."
      : error.message.includes("not_found")
        ? "That event no longer exists. Go back to the inbox."
        : "The event didn't save. Try again in a moment.";
    return { error: msg, values: valuesOf(formData) };
  }
  revalidatePath("/", "layout");
  redirect("/admin/inbox?saved=1");
}
