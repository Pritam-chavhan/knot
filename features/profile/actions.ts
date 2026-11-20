"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { onboardingSchema } from "@/features/auth/validation";

export type ProfileFormState = { error?: string; saved?: boolean };

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const { supabase, user, profile } = await requireMember({ allowNotOnboarded: true });
  const parsed = onboardingSchema.safeParse({
    displayName: formData.get("displayName"),
    programme: formData.get("programme"),
    batchYear: formData.get("batchYear"),
    bio: formData.get("bio") ?? "",
    interests: formData.getAll("interests"),
    showGoing: formData.get("showGoing") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

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
  if (profileError) return { error: "Couldn't save your profile. Please try again." };

  await supabase.from("profile_interests").delete().eq("profile_id", user.id);
  if (v.interests.length) {
    const { error } = await supabase
      .from("profile_interests")
      .insert(v.interests.map((interest_id) => ({ profile_id: user.id, interest_id })));
    if (error) return { error: "Couldn't save your interests. Please try again." };
  }

  const { error: privacyError } = await supabase
    .from("privacy_settings")
    .update({ show_going_default: v.showGoing })
    .eq("profile_id", user.id);
  if (privacyError) return { error: "Couldn't save your privacy setting. Please try again." };

  revalidatePath("/", "layout");
  if (!profile.onboarded_at) redirect("/discover");
  return { saved: true };
}

export async function savePrivacy(formData: FormData) {
  const { supabase, user } = await requireMember();
  await supabase
    .from("privacy_settings")
    .update({
      show_going_default: formData.get("showGoing") === "on",
      allow_requests: formData.get("allowRequests") === "on",
    })
    .eq("profile_id", user.id);
  revalidatePath("/profile");
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
