import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { ProfileForm } from "@/features/profile/profile-form";
import { loadProfileFormData } from "@/features/profile/queries";

export default async function Onboarding() {
  const { supabase, user, profile } = await requireMember({ allowNotOnboarded: true });
  if (profile.onboarded_at) redirect("/discover");
  const data = await loadProfileFormData(supabase, user.id);

  return (
    <main className="mx-auto max-w-md px-6 pt-7 pb-12">
      <Logo />
      <h1 className="mt-8 font-serif text-[40px] leading-none">
        Welcome. <em>Who are you?</em>
      </h1>
      <p className="mt-3 text-base text-soft">This takes a minute. It helps you find the right events and people.</p>
      <div className="mt-8">
        <ProfileForm
          interests={data.interests}
          initial={{ displayName: "", programme: "", batchYear: null, bio: "", interestIds: [], showGoing: data.showGoing }}
          submitLabel="Start exploring"
        />
      </div>
    </main>
  );
}
