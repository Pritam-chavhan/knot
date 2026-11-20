import { requireMember } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireMember();
  // Counts this student as active today (writes at most once an hour).
  await supabase.rpc("touch_activity");
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex-1 pb-24">{children}</div>
      <BottomNav />
    </div>
  );
}
