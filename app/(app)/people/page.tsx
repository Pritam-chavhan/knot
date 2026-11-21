import { requireMember } from "@/lib/auth";
import { BackButton } from "@/components/back-button";
import { loadPeople, peopleCount } from "@/features/people/directory-queries";
import { PeopleDirectory } from "@/features/people/people-directory";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const { supabase } = await requireMember();
  const [suggestions, count] = await Promise.all([loadPeople(supabase, null, 30), peopleCount(supabase)]);
  return (
    <main className="px-5 pt-6">
      <BackButton fallback="/discover" />
      <h1 className="font-display mt-3 text-[34px] leading-none font-extrabold">People</h1>
      <p className="mt-2 text-[15px] text-soft">
        {count === 1 ? "1 other student is on KNOT." : `${count} other students are on KNOT.`} Connect, then chat.
      </p>
      <PeopleDirectory suggestions={suggestions} count={count} />
    </main>
  );
}
