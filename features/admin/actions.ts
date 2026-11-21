"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminActionState = { error?: string; ok?: string };

const MESSAGES: Record<string, string> = {
  not_yourself: "You can't do that to your own account.",
  not_found: "That account or event no longer exists.",
  not_allowed: "Only admins can do that.",
  protected_admin: "Only the founder can suspend or demote another admin, and the founder can't be changed.",
  already_resolved: "Someone already dealt with this report.",
  no_person: "There's no one to suspend on this report.",
  bad_action: "That action doesn't fit this report.",
};
const friendly = (m?: string) => MESSAGES[Object.keys(MESSAGES).find((k) => m?.includes(k)) ?? ""] ?? "That didn't work. Try again.";

const id = z.string().uuid();

export async function setStatus(_prev: AdminActionState, fd: FormData): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const profile = id.safeParse(fd.get("profileId"));
  const status = z.enum(["active", "suspended"]).safeParse(fd.get("status"));
  if (!profile.success || !status.success) return { error: "That didn't work. Reload and try again." };
  const note = String(fd.get("note") ?? "").slice(0, 280);
  const { error } = await supabase.rpc("admin_set_status", { p_profile: profile.data, p_status: status.data, p_note: note || null });
  if (error) return { error: friendly(error.message) };
  // End their sessions now instead of when they next load a page.
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(profile.data, {
    ban_duration: status.data === "suspended" ? "876000h" : "none",
  });
  if (banError) return { error: "Status changed, but their current session couldn't be ended. It ends within an hour." };
  revalidatePath("/admin", "layout");
  return { ok: status.data === "suspended" ? "Suspended." : "Restored." };
}

export async function setRole(_prev: AdminActionState, fd: FormData): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const profile = id.safeParse(fd.get("profileId"));
  const role = z.enum(["student", "admin"]).safeParse(fd.get("role"));
  if (!profile.success || !role.success) return { error: "That didn't work. Reload and try again." };
  const { error } = await supabase.rpc("admin_set_role", { p_profile: profile.data, p_role: role.data });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: role.data === "admin" ? "Now an admin." : "Admin removed." };
}

export async function eventAction(_prev: AdminActionState, fd: FormData): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const event = id.safeParse(fd.get("eventId"));
  const action = z.enum(["cancel_event", "hide_event", "restore_event"]).safeParse(fd.get("action"));
  if (!event.success || !action.success) return { error: "That didn't work. Reload and try again." };
  const { error } = await supabase.rpc("admin_event_action", { p_event: event.data, p_action: action.data, p_note: null });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/admin", "layout");
  revalidatePath("/discover");
  revalidatePath(`/events/${event.data}`);
  revalidatePath("/", "layout");
  return { ok: { cancel_event: "Cancelled.", hide_event: "Hidden from students.", restore_event: "Live on Discover." }[action.data] };
}

export async function resolveProposal(_prev: AdminActionState, fd: FormData): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const announcement = id.safeParse(fd.get("announcementId"));
  const choice = z.enum(["apply", "dismiss"]).safeParse(fd.get("choice"));
  if (!announcement.success || !choice.success) return { error: "That didn't work. Reload and try again." };
  const { error } = await supabase.rpc("admin_resolve_proposal", { p_announcement: announcement.data, p_apply: choice.data === "apply" });
  if (error) return { error: error.message.includes("not_found") ? "Already handled." : friendly(error.message) };
  revalidatePath("/", "layout");
  return { ok: choice.data === "apply" ? "Change applied." : "Dismissed." };
}

export async function resolveReport(_prev: AdminActionState, fd: FormData): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const report = id.safeParse(fd.get("reportId"));
  const action = z.enum(["dismiss", "suspend_user", "hide_event"]).safeParse(fd.get("action"));
  if (!report.success || !action.success) return { error: "That didn't work. Reload and try again." };
  const note = String(fd.get("note") ?? "").slice(0, 280);
  const { error } = await supabase.rpc("admin_resolve_report", { p_report: report.data, p_action: action.data, p_note: note || null });
  if (error) return { error: friendly(error.message) };

  if (action.data === "suspend_user") {
    // End their sessions now. The person comes from the report itself, never from the form.
    const { data: r } = await supabase.from("reports").select("subject_id").eq("id", report.data).single<{ subject_id: string | null }>();
    if (r?.subject_id) {
      const { error: banError } = await createAdminClient().auth.admin.updateUserById(r.subject_id, { ban_duration: "876000h" });
      if (banError) return { error: "Suspended, but their current session couldn't be ended. It ends within an hour." };
    }
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: { dismiss: "Dismissed.", suspend_user: "Suspended. Their open reports are closed.", hide_event: "Event hidden from students." }[action.data] };
}
