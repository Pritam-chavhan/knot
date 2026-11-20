"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { onboardingSchema } from "@/features/auth/validation";

export type ProfileField = "displayName" | "programme" | "batchYear" | "bio" | "interests";
export type ProfileValues = {
  displayName: string;
  programme: string;
  batchYear: string;
  bio: string;
  interests: number[];
  showGoing: boolean;
};
// On error the submitted values come back, so nothing the student typed is lost.
export type ProfileFormState = { error?: string; field?: ProfileField; saved?: boolean; values?: ProfileValues };
export type PrivacyFormState = { error?: string; saved?: boolean };

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const { supabase, user, profile } = await requireMember({ allowNotOnboarded: true });
  const values: ProfileValues = {
    displayName: String(formData.get("displayName") ?? ""),
    programme: String(formData.get("programme") ?? ""),
    batchYear: String(formData.get("batchYear") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    interests: formData.getAll("interests").map(Number).filter(Number.isInteger),
    showGoing: formData.get("showGoing") === "on",
  };
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: issue.path[0] as ProfileField, values };
  }
  const v = parsed.data;
  const fail = (error: string) => ({ error, values });

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: v.displayName,
      programme: v.programme,
      batch_year: v.batchYear,
      bio: v.bio || null,
      onboarded_at: profile.onboarded_at ?? new Date().toISOString(),
    })
    .eq("id", user.id);
  if (profileError) return fail("Your profile didn't save. Check your connection and try again.");

  const { error: interestsError } = await supabase.rpc("set_my_interests", { p_ids: v.interests });
  if (interestsError) return fail("Your interests didn't save. Try again in a moment.");

  const { error: privacyError } = await supabase
    .from("privacy_settings")
    .update({ show_going_default: v.showGoing })
    .eq("profile_id", user.id);
  if (privacyError) return fail("Your privacy setting didn't save. Try again in a moment.");

  revalidatePath("/", "layout");
  if (!profile.onboarded_at) redirect("/discover");
  return { saved: true };
}

export async function savePrivacy(_prev: PrivacyFormState, formData: FormData): Promise<PrivacyFormState> {
  const { supabase, user } = await requireMember();
  const { error } = await supabase
    .from("privacy_settings")
    .update({
      show_going_default: formData.get("showGoing") === "on",
      allow_requests: formData.get("allowRequests") === "on",
    })
    .eq("profile_id", user.id);
  if (error) return { error: "Your privacy settings didn't save. Try again in a moment." };
  revalidatePath("/profile");
  return { saved: true };
}

export async function deleteAccount(formData: FormData) {
  const { supabase, user } = await requireMember({ allowNotOnboarded: true });
  if (formData.get("confirm") !== "DELETE") redirect("/profile?delete=confirm");
  // Removing the auth user cascades to the profile and everything linked to it.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) redirect("/profile?delete=failed");
  await supabase.auth.signOut();
  redirect("/");
}
