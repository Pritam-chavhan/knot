import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEEDBACK_EMAIL } from "@/lib/contact";

export type PushPayload = {
  title: string;
  body: string;
  // Where tapping the notification opens.
  url: string;
  // Notifications with the same tag replace each other (one per chat).
  tag: string;
};

type Keys = { publicKey: string; privateKey: string };
let cached: Keys | null = null;

// The server's push signing keys. Created once, on first use, and stored in
// the database where only the server can read them, so no secret ever has to
// be copied by hand.
async function keys(): Promise<Keys> {
  if (cached) return cached;
  const db = createAdminClient();
  const read = async () => {
    const { data } = await db.from("push_keys").select("public_key, private_key").eq("id", 1).maybeSingle<{ public_key: string; private_key: string }>();
    return data ? { publicKey: data.public_key, privateKey: data.private_key } : null;
  };
  let k = await read();
  if (!k) {
    const fresh = webpush.generateVAPIDKeys();
    // If two servers race, the first insert wins and both read it back.
    await db.from("push_keys").insert({ id: 1, public_key: fresh.publicKey, private_key: fresh.privateKey });
    k = await read();
  }
  if (!k) throw new Error("push_keys_unavailable");
  cached = k;
  return k;
}

export async function pushPublicKey(): Promise<string | null> {
  try {
    return (await keys()).publicKey;
  } catch {
    return null;
  }
}

// Sends one notification to every phone a student turned notifications on
// for. `key` names the event; the same key is never sent twice. Never throws:
// a failed notification must not break the action that caused it.
export async function notify(profileId: string, key: string, payload: PushPayload) {
  try {
    const db = createAdminClient();
    const { data: fresh } = await db.rpc("claim_push", { p_key: key });
    if (fresh !== true) return;
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("profile_id", profileId)
      .limit(10);
    if (!subs?.length) return;
    const k = await keys();
    const body = JSON.stringify(payload);
    await Promise.all(
      (subs as { endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
            vapidDetails: { subject: `mailto:${FEEDBACK_EMAIL}`, publicKey: k.publicKey, privateKey: k.privateKey },
            TTL: 60 * 60 * 6,
            urgency: "high",
            timeout: 8000,
          });
        } catch (e) {
          // The phone turned notifications off or the browser dropped it.
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }),
    );
  } catch {
    // Best effort.
  }
}
