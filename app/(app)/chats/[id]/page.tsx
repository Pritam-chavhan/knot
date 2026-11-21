import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import { loadThread } from "@/features/chat/queries";
import { ChatThread } from "@/features/chat/thread";

export const metadata = { title: "Chat" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireMember();
  const thread = await loadThread(supabase, id, user.id);
  if (!thread) notFound();
  const o = thread.other;
  return (
    <ChatThread
      key={thread.connectionId}
      connectionId={thread.connectionId}
      me={user.id}
      other={{
        id: o.id,
        name: o.display_name ?? "Student",
        subtitle: [o.programme, o.batch_year && `Class of ${o.batch_year}`].filter(Boolean).join(", "),
        avatar: avatarSrc(o.id, o.avatar_path),
      }}
      initial={thread.messages}
    />
  );
}
