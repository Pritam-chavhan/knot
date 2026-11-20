import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  programme: string | null;
  batch_year: number | null;
  bio: string | null;
  role: "student" | "admin";
  status: "active" | "suspended";
  onboarded_at: string | null;
  is_founder?: boolean;
};

// Returns the signed-in student's profile, or sends them to the right place.
export async function requireMember(options: { allowNotOnboarded?: boolean } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Your own full profile (email, role) comes from a function: classmates can
  // only read public profile fields.
  const { data: rows } = await supabase.rpc("my_profile");
  const profile = (rows as Profile[] | null)?.[0];

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/?error=no-profile");
  }
  if (profile.status !== "active") {
    // Sign out first, or the landing page would send them straight back here.
    await supabase.auth.signOut();
    redirect("/?error=suspended");
  }
  // New students see the welcome tour first; it ends on the profile setup.
  if (!profile.onboarded_at && !options.allowNotOnboarded) redirect("/welcome");
  return { supabase, user, profile };
}

export async function requireAdmin() {
  const ctx = await requireMember();
  if (ctx.profile.role !== "admin") redirect("/discover");
  return ctx;
}
