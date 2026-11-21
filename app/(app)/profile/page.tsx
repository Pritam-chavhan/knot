import { requireMember } from "@/lib/auth";
import { loadProfileFormData } from "@/features/profile/queries";
import { ProfileView } from "@/features/profile/profile-view";
import { loadBlocks } from "@/features/chat/queries";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ delete?: string }> }) {
  const { supabase, user, profile } = await requireMember();
  const [data, blocked] = await Promise.all([loadProfileFormData(supabase, user.id), loadBlocks(supabase)]);
  const { delete: deleteState } = await searchParams;
  return <ProfileView profile={profile} data={data} blocked={blocked} deleteState={deleteState} />;
}
