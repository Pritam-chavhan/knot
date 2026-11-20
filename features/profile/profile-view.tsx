import Link from "next/link";
import type { Profile } from "@/lib/auth";
import { Avatar, Button } from "@/components/ui";
import { ProfileForm } from "@/features/profile/profile-form";
import { deleteAccount } from "@/features/profile/actions";
import { PrivacyForm } from "@/features/profile/privacy-form";
import { signOut } from "@/features/auth/actions";

const DELETE_MESSAGES: Record<string, string> = {
  confirm: "Type DELETE in capitals to confirm.",
  failed: "Your account wasn't deleted. Try again in a minute.",
};

type FormData = { interests: { id: number; name: string }[]; interestIds: number[]; showGoing: boolean; allowRequests: boolean };

export function ProfileView({ profile, data, deleteState }: { profile: Profile; data: FormData; deleteState?: string }) {
  const name = profile.display_name ?? "You";
  const myInterests = data.interests.filter((i) => data.interestIds.includes(i.id));

  return (
    <main className="px-5 pt-6">
      <section className="rounded-[30px] bg-ink p-6 text-white">
        <div className="flex items-center gap-4">
          <Avatar name={name} size={64} index={0} className="ring-ink" />
          <div className="min-w-0">
            <h1 className="font-display truncate text-[28px] leading-tight font-extrabold">{name}</h1>
            <p className="text-[14px] text-white/70">
              {[profile.programme, profile.batch_year && `Class of ${profile.batch_year}`].filter(Boolean).join(", ")}
            </p>
          </div>
        </div>
        {profile.bio && <p className="mt-4 text-[15px] leading-relaxed text-white/85">{profile.bio}</p>}
        {myInterests.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {myInterests.map((i) => (
              <li key={i.id} className="rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold">
                {i.name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[12px] text-white/55">{profile.email}</p>
      </section>

      <h2 className="font-display mt-8 mb-3 text-[20px] font-extrabold">Edit profile</h2>
      <ProfileForm
        interests={data.interests}
        initial={{
          displayName: profile.display_name ?? "",
          programme: profile.programme ?? "",
          batchYear: profile.batch_year,
          bio: profile.bio ?? "",
          interestIds: data.interestIds,
          showGoing: data.showGoing,
        }}
        submitLabel="Save profile"
      />

      <h2 className="font-display mt-8 mb-3 text-[20px] font-extrabold">Privacy</h2>
      <PrivacyForm showGoing={data.showGoing} allowRequests={data.allowRequests} />

      <div className="mt-8 flex flex-col gap-3">
        {profile.role === "admin" && (
          <Link href="/admin" className="flex items-center justify-between rounded-[24px] bg-ink px-5 py-4 text-white">
            <span className="font-bold">Founder dashboard</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        )}
        <Link href="/welcome" className="flex items-center justify-between rounded-[24px] bg-card px-5 py-4">
          <span className="font-bold">How KNOT works</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="w-full">
            Sign out
          </Button>
        </form>
      </div>

      <details open={!!deleteState} className="group mt-8 mb-8 rounded-[28px] bg-card p-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center font-bold text-warn">Delete my account</summary>
        <p className="mt-3 text-[14px] text-soft">
          This permanently removes your profile, events you host and your messages. It can&apos;t be undone.
        </p>
        <form action={deleteAccount} className="mt-4 flex flex-col gap-3">
          <label htmlFor="confirm" className="text-sm font-semibold">
            Type DELETE to confirm
          </label>
          <input id="confirm" name="confirm" autoComplete="off" className="h-12 rounded-[18px] border-[1.5px] border-line bg-paper px-4 focus:border-warn focus:outline-none" />
          {deleteState && DELETE_MESSAGES[deleteState] && (
            <p role="alert" className="text-sm font-medium text-warn">
              {DELETE_MESSAGES[deleteState]}
            </p>
          )}
          <Button type="submit" variant="danger">
            Delete my account
          </Button>
        </form>
      </details>
    </main>
  );
}
