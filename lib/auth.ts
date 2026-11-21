import "server-only";
import { cache } from "react";
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
  avatar_path: string | null;
  github: string | null;
  instagram: string | null;
  linkedin: string | null;
};

// The signed-in user's id, from the session token verified locally with the
// project's public signing key. Once per request: the layout and the page share it.
export const currentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
});

// Returns the signed-in student's profile, or sends them to the right place.
export async function requireMember(options: { allowNotOnboarded?: boolean } = {}) {
  const ctx = await loadMember();
  if (!ctx.profile.onboarded_at && !options.allowNotOnboarded) redirect("/welcome");
  return ctx;
}

// One sign-in check and one profile read per request, shared by the layout and the page.
const loadMember = cache(async () => {
  const supabase = await createClient();
  const id = await currentUserId();
  if (!id) redirect("/");
  const user = { id };

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
  // New students see the welcome tour first (checked in requireMember).
  return { supabase, user, profile };
});

export async function requireAdmin() {
  const ctx = await requireMember();
  if (ctx.profile.role !== "admin") redirect("/discover");
  return ctx;
}
