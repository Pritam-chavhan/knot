import { requireMember } from "@/lib/auth";
import { loadChats } from "@/features/chat/queries";
import { ChatsView } from "@/features/chat/chats-view";

export const metadata = { title: "Chats" };

export default async function ChatsPage() {
  const { supabase, user } = await requireMember();
  const data = await loadChats(supabase, user.id);
  return <ChatsView data={data} />;
}
