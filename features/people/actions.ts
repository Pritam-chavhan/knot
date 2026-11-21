"use server";

import { requireMember } from "@/lib/auth";
import { loadPeople, type PersonCardData } from "./directory-queries";

// Live search on the People screen.
export async function searchPeople(query: unknown): Promise<PersonCardData[]> {
  const { supabase } = await requireMember();
  const q = typeof query === "string" ? query.trim().slice(0, 60) : "";
  return loadPeople(supabase, q || null, 40);
}
