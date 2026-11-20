"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { codeSchema, toInstitutionEmail } from "./validation";

export type FormState = { error?: string; email?: string };

export async function sendCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const { email, error } = toInstitutionEmail(String(formData.get("email") ?? ""), env.institutionDomain());
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
    if (otpError.status === 429) return { error: "You've asked for a few links in a row. Wait a minute, then try again." };
    return { error: "Your sign-in link didn't send. Try again in a moment." };
  }
  redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
}

export async function verifyCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = codeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success) return { email, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: parsed.data, type: "email" });
  if (error) return { email, error: "That code didn't match. Check the latest email, or ask for a new link." };
  redirect("/discover");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
