import { requireMember } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { countToReview } from "@/features/activity/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireMember();
  const [, toReview] = await Promise.all([
    // Counts this student as active today.
    supabase.rpc("touch_activity"),
    countToReview(supabase, user.id),
  ]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex-1 pb-32">{children}</div>
      <BottomNav activityCount={toReview} />
    </div>
  );
}
