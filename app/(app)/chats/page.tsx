import { requireMember } from "@/lib/auth";
import { pushPublicKey } from "@/lib/push";
import { loadChats } from "@/features/chat/queries";
import { ChatsView } from "@/features/chat/chats-view";

export const metadata = { title: "Chats" };

export default async function ChatsPage() {
  const { supabase, user } = await requireMember();
  const [data, pushKey] = await Promise.all([loadChats(supabase, user.id), pushPublicKey()]);
  return <ChatsView data={data} pushKey={pushKey} />;
}
