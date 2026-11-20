import { requireMember } from "@/lib/auth";
import { Button, Card } from "@/components/ui";
import { ProfileForm } from "@/features/profile/profile-form";
import { loadProfileFormData } from "@/features/profile/queries";
import { deleteAccount, savePrivacy } from "@/features/profile/actions";
import { signOut } from "@/features/auth/actions";

const DELETE_MESSAGES: Record<string, string> = {
  confirm: "Type DELETE in capitals to confirm.",
  failed: "We couldn't delete your account. Please try again.",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ delete?: string }> }) {
  const { supabase, user, profile } = await requireMember();
  const data = await loadProfileFormData(supabase, user.id);
  const { delete: deleteState } = await searchParams;

  return (
    <main className="px-5 pt-6">
      <h1 className="font-serif text-[34px] leading-tight">
        You, <em>on KNOT</em>
      </h1>
      <p className="mt-1 text-sm text-muted">{profile.email}</p>

      <section className="mt-6" aria-labelledby="profile-h">
        <h2 id="profile-h" className="sr-only">
          Profile
        </h2>
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
      </section>

      <Card className="mt-8">
        <h2 className="font-serif text-2xl">Privacy</h2>
        <form action={savePrivacy} className="mt-4 flex flex-col gap-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="showGoing" defaultChecked={data.showGoing} className="mt-1 h-5 w-5 accent-ink" />
            <span>
              <span className="block font-medium">Show me as going by default</span>
              <span className="text-sm text-muted">Others going to the same event can see you.</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="allowRequests" defaultChecked={data.allowRequests} className="mt-1 h-5 w-5 accent-ink" />
            <span>
              <span className="block font-medium">Allow requests to connect</span>
              <span className="text-sm text-muted">Turn off to stop all new requests.</span>
            </span>
          </label>
          <Button type="submit" variant="ghost">
            Save privacy
          </Button>
        </form>
      </Card>

      <form action={signOut} className="mt-8">
        <Button type="submit" variant="ghost" className="w-full">
          Sign out
        </Button>
      </form>

      <Card className="mt-8 mb-6">
        <h2 className="font-serif text-2xl">Delete account</h2>
        <p className="mt-2 text-sm text-soft">This permanently removes your profile, events you host, and messages. It can&apos;t be undone.</p>
        <form action={deleteAccount} className="mt-4 flex flex-col gap-3">
          <label htmlFor="confirm" className="text-sm font-medium text-soft">
            Type DELETE to confirm
          </label>
          <input id="confirm" name="confirm" autoComplete="off" className="h-12 rounded-2xl border border-line bg-paper px-4" />
          {deleteState && DELETE_MESSAGES[deleteState] && (
            <p role="alert" className="text-sm text-warn">
              {DELETE_MESSAGES[deleteState]}
            </p>
          )}
          <Button type="submit" variant="danger">
            Delete my account
          </Button>
        </form>
      </Card>
    </main>
  );
}
