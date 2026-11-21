"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { codeSchema, toInstitutionEmail } from "./validation";

export type FormState = { error?: string; email?: string; sent?: number };

// Sends a sign-in code. Sending through the KNOT mailbox takes a few
// seconds, so people often tap twice; if a code went out moments ago, that
// counts as sent and they go straight to typing it in.
async function requestCode(rawEmail: string): Promise<{ email?: string; error?: string }> {
  const { email, error } = toInstitutionEmail(rawEmail, env.institutionDomain());
  if (!email) return { error };

  // Refuse shared and role addresses before any email is sent.
  const admin = createAdminClient();
  const { data: allowed, error: checkError } = await admin.rpc("email_is_allowed", { p_email: email });
  if (checkError) return { error: "We couldn't check your email just now. Try again in a moment." };
  if (!allowed) {
    return { error: "This looks like a shared or office address. Use your own student email." };
  }

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (otpError) {
    // A code for this email went out in the last minute: use that one.
    if (otpError.code === "over_email_send_rate_limit" && /\d+ seconds/.test(otpError.message)) return { email };
    if (otpError.status === 429) return { error: "Lots of people are signing in right now. Wait a minute, then try again." };
    return { error: "Your code didn't send. Try again in a moment." };
  }
  return { email };
}

export async function sendCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const { email, error } = await requestCode(String(formData.get("email") ?? ""));
  if (!email) return { error };
  redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
}

export async function resendCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const result = await requestCode(email);
  if (!result.email) return { email, error: result.error };
  return { email, sent: Date.now() };
}

export async function verifyCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = codeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success) return { email, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: parsed.data, type: "email" });
  if (error) {
    if (error.status === 429) return { email, error: "Too many tries. Wait a minute, then try again." };
    if (error.code === "otp_expired") {
      return { email, error: "That code has expired or a newer one was sent. Use the code from the newest email, or send a new one." };
    }
    return { email, error: "That code didn't match. Use the 6-digit code from the newest KNOT email." };
  }
  redirect("/discover");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
