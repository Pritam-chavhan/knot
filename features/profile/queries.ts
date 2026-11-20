import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadProfileFormData(supabase: SupabaseClient, userId: string) {
  const [{ data: interests }, { data: mine }, { data: privacy }] = await Promise.all([
    supabase.from("interests").select("id, name").order("name"),
    supabase.from("profile_interests").select("interest_id").eq("profile_id", userId),
    supabase.from("privacy_settings").select("show_going_default, allow_requests").eq("profile_id", userId).single(),
  ]);
  return {
    interests: interests ?? [],
    interestIds: (mine ?? []).map((r) => r.interest_id as number),
    showGoing: privacy?.show_going_default ?? true,
    allowRequests: privacy?.allow_requests ?? true,
  };
}
