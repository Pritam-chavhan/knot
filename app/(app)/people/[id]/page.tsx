import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { loadPerson } from "@/features/people/queries";
import { PersonView } from "@/features/people/person-view";

export const metadata = { title: "Profile" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireMember();
  const data = await loadPerson(supabase, id, user.id);
  if (!data) notFound();
  return <PersonView data={data} />;
}
