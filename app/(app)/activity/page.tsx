import { requireMember } from "@/lib/auth";
import { loadActivity } from "@/features/activity/queries";
import { ActivityView } from "@/features/activity/activity-view";

export const metadata = { title: "Plan requests" };

export default async function ActivityPage() {
  const { supabase, user } = await requireMember();
  const data = await loadActivity(supabase, user.id);
  return <ActivityView data={data} />;
}
