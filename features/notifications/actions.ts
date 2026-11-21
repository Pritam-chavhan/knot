"use server";

import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { notifyMessage, notifyWave } from "./send";

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(sub: unknown): Promise<{ ok: boolean }> {
  const { supabase } = await requireMember();
  const parsed = subscriptionSchema.safeParse(sub);
  if (!parsed.success) return { ok: false };
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
  });
  return { ok: !error };
}

export async function removePushSubscription(endpoint: unknown): Promise<void> {
  const { supabase } = await requireMember();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return;
  await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
}

const uuid = z.string().uuid();
const me = (p: { id: string; display_name: string | null }) => ({ id: p.id, name: p.display_name?.trim() || "Someone at IITGN" });

// Called by the phone after a message or a wave is sent from the browser.
// The database decides whether the message or wave exists and who gets told.
export async function afterMessageSent(messageId: unknown): Promise<void> {
  const { supabase, profile } = await requireMember();
  const parsed = uuid.safeParse(messageId);
  if (parsed.success) await notifyMessage(supabase, me(profile), parsed.data);
}

export async function afterWaveSent(to: unknown): Promise<void> {
  const { supabase, profile } = await requireMember();
  const parsed = uuid.safeParse(to);
  if (parsed.success) await notifyWave(supabase, me(profile), parsed.data);
}
