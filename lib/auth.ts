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
};

// Returns the signed-in student's profile, or sends them to the right place.
export async function requireMember(options: { allowNotOnboarded?: boolean } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, programme, batch_year, bio, role, status, onboarded_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/?error=no-profile");
  }
  if (profile.status !== "active") redirect("/?error=suspended");
  if (!profile.onboarded_at && !options.allowNotOnboarded) redirect("/onboarding");
  return { supabase, user, profile };
}

export async function requireAdmin() {
  const ctx = await requireMember();
  if (ctx.profile.role !== "admin") redirect("/discover");
  return ctx;
}
