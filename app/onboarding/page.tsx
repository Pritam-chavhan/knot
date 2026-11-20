import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { ProfileForm } from "@/features/profile/profile-form";
import { loadProfileFormData } from "@/features/profile/queries";
import { PhotoPicker } from "@/features/profile/photo-picker";
import { avatarSrc } from "@/lib/avatar";

export default async function Onboarding() {
  const { supabase, user, profile } = await requireMember({ allowNotOnboarded: true });
  if (profile.onboarded_at) redirect("/discover");
  const data = await loadProfileFormData(supabase, user.id);

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12">
      <div className="flex items-center justify-between">
        <Logo />
        <Link href="/welcome" className="-mr-2 flex min-h-11 items-center rounded-full px-3.5 text-[14px] font-bold text-thread hover:bg-thread-tint">
          Replay the tour
        </Link>
      </div>
      <div className="mt-7 rounded-[30px] bg-thread px-5 pt-6 pb-7 text-white">
        <p className="text-[13px] font-semibold text-white/90">Last step</p>
        <h1 className="font-display mt-1 text-[34px] leading-[1.02] font-extrabold">Tell campus who you are</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/85">
          A name, your batch and a few interests. It helps the right people find you, and takes about a minute.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-4">
        <PhotoPicker name={profile.display_name ?? profile.email} src={avatarSrc(profile.id, profile.avatar_path)} />
        <ProfileForm
          interests={data.interests}
          initial={{ displayName: "", programme: "", batchYear: null, bio: "", interestIds: [], showGoing: data.showGoing, github: "", instagram: "", linkedin: "" }}
          submitLabel="Start exploring"
        />
      </div>
    </main>
  );
}
