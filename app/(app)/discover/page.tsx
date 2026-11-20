import { requireMember } from "@/lib/auth";
import { DiscoverView } from "@/features/discover/discover-view";

export default async function Discover() {
  const { profile } = await requireMember();
  return <DiscoverView profile={profile} />;
}
