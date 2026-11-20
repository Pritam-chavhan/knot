"use server";

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
  if (checkError) return { error: "Something went wrong. Please try again." };
  if (!allowed) {
    return { error: "This address can't be used. Sign in with your personal student email." };
  }

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (otpError) {
    if (otpError.status === 429) return { error: "Too many codes requested. Wait a minute and try again." };
    return { error: "We couldn't send a code right now. Please try again." };
  }
  redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
}

export async function verifyCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = codeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success) return { email, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: parsed.data, type: "email" });
  if (error) return { email, error: "That code didn't work. Check it, or request a new one." };
  redirect("/discover");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
