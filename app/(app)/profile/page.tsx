import { requireMember } from "@/lib/auth";
import { loadProfileFormData } from "@/features/profile/queries";
import { ProfileView } from "@/features/profile/profile-view";
import { loadBlocks } from "@/features/chat/queries";
import { pushPublicKey } from "@/lib/push";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ delete?: string }> }) {
  const { supabase, user, profile } = await requireMember();
  const [data, blocked, pushKey] = await Promise.all([loadProfileFormData(supabase, user.id), loadBlocks(supabase), pushPublicKey()]);
  const { delete: deleteState } = await searchParams;
  return <ProfileView profile={profile} data={data} blocked={blocked} pushKey={pushKey} deleteState={deleteState} />;
}
