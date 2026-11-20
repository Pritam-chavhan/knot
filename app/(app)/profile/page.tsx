import { requireMember } from "@/lib/auth";
import { loadProfileFormData } from "@/features/profile/queries";
import { ProfileView } from "@/features/profile/profile-view";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ delete?: string }> }) {
  const { supabase, user, profile } = await requireMember();
  const data = await loadProfileFormData(supabase, user.id);
  const { delete: deleteState } = await searchParams;
  return <ProfileView profile={profile} data={data} deleteState={deleteState} />;
}
