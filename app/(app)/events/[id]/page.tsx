import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { loadEvent } from "@/features/events/queries";
import { EventView } from "@/features/events/event-view";

export const metadata = { title: "Event" };

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireMember();
  const data = await loadEvent(supabase, id, user.id);
  if (!data) notFound();
  return <EventView data={data} userId={user.id} isNew={!!isNew} />;
}
