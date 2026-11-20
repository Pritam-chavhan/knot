import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui";
import { SignInForm } from "./sign-in-form";

const ERRORS: Record<string, string> = {
  suspended: "This account is suspended. Contact the KNOT team if you think this is a mistake.",
  "no-profile": "We couldn't find your profile. Please sign in again.",
};

export default async function Landing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/discover");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-7 pb-8">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted">IIT Gandhinagar</span>
      </header>

      <h1 className="mt-12 font-serif text-[52px] leading-[0.98] tracking-tight">
        Know what&apos;s on.
        <br />
        <em>Meet who&apos;s going.</em>
      </h1>
      <p className="mt-5 text-base leading-relaxed text-soft">
        Every campus event in one place, who&apos;s going, and people to go with. Host your own, find your crew, and see
        who&apos;s around. Only for IITGN students.
      </p>

      {error && ERRORS[error] && (
        <p role="alert" className="mt-6 rounded-2xl bg-warn/10 p-4 text-sm text-warn">
          {ERRORS[error]}
        </p>
      )}

      <div className="mt-auto pt-10">
        <SignInForm />
        <p className="mt-4 text-center text-xs text-muted">
          An independent student project, not affiliated with IIT Gandhinagar.
        </p>
      </div>
    </main>
  );
}
