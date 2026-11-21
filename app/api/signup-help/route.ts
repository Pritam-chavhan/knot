import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { institutionForScript } from "@/lib/script-auth";
import { helpEmail, type HelpStage } from "@/features/signup-help/emails";
import { alertStillStuck } from "@/features/notifications/send";

export const runtime = "nodejs";
export const maxDuration = 30;

// The sign-up helper. The campus mail script calls this every minute:
// "claim" returns the help emails due now (KNOT decides who and when), and
// "done" reports which were sent. Same private token as the campus feed.

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim") }),
  z.object({
    action: z.literal("done"),
    sent: z.array(z.string().uuid()).max(50).default([]),
    failed: z.array(z.string().uuid()).max(50).default([]),
  }),
]);

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

type Claim = { nudge_id: string; email: string; display_name: string | null; stage: HelpStage; attempt: 1 | 2 };

// A fresh sign-in code and one-tap link for someone who never received
// theirs, made without Supabase emailing anything. Only for students who
// haven't entered a code yet (the database only hands those out at that
// stage). Null if one can't be made; the email then just explains the steps.
async function freshSignIn(admin: SupabaseClient, email: string, site: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const p = data?.properties;
  if (error || !p?.email_otp || !p.hashed_token) {
    console.warn("signup_help_link_failed", error?.code ?? error?.message ?? "no_token");
    return null;
  }
  return { code: p.email_otp, link: `${site}/auth/callback?token_hash=${encodeURIComponent(p.hashed_token)}&type=magiclink` };
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 20_000) return json(413, { error: "too_large" });
  const auth = await institutionForScript(request);
  if (!auth) {
    console.warn("signup_help_unauthorized");
    return json(401, { error: "unauthorized" });
  }
  let parsed;
  try {
    parsed = body.safeParse(await request.json());
  } catch {
    return json(400, { error: "bad_request" });
  }
  if (!parsed.success) return json(400, { error: "bad_request" });
  const { admin, inst } = auth;

  if (parsed.data.action === "done") {
    const { error } = await admin.rpc("finish_signup_nudges", { p_institution: inst.id, p_sent: parsed.data.sent, p_failed: parsed.data.failed });
    if (error) return json(500, { error: "failed" });
    return json(200, { ok: true });
  }

  const [{ data, error }, stuck] = await Promise.all([
    admin.rpc("claim_signup_nudges", { p_institution: inst.id, p_limit: 20 }),
    admin.rpc("escalate_signup_nudges", { p_institution: inst.id }),
  ]);
  if (error) return json(500, { error: "failed" });
  for (const s of (stuck.data ?? []) as { profile_id: string; email: string; stage: string }[]) alertStillStuck(s.profile_id, s.email, s.stage);

  const site = new URL(request.url).origin;
  const emails = await Promise.all(
    ((data ?? []) as Claim[]).map(async (c) => ({
      id: c.nudge_id,
      to: c.email,
      ...helpEmail({
        stage: c.stage,
        attempt: c.attempt,
        email: c.email,
        name: c.display_name,
        site,
        signIn: c.stage === "code_sent" ? await freshSignIn(admin, c.email, site) : null,
      }),
    })),
  );
  return json(200, { emails });
}
