import { requireMember } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { chatsBadge } from "@/features/chat/queries";
import { AutoPush } from "@/features/notifications/auto-push";
import { pushPublicKey } from "@/lib/push";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireMember();
  const [, badge, pushKey] = await Promise.all([
    // Counts this student as active today.
    supabase.rpc("touch_activity"),
    chatsBadge(supabase, user.id),
    pushPublicKey(),
  ]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex-1 pb-32">{children}</div>
      <BottomNav chatsCount={badge} />
      {pushKey && <AutoPush publicKey={pushKey} />}
    </div>
  );
}
