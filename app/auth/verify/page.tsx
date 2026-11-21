import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  if (!email) redirect("/");
  const [local, domain] = email.split("@");
  const masked = `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-6 pb-8">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-card">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <Logo />
      </header>

      <div className="mt-8 rounded-[30px] bg-marigold-tint p-6">
        <svg width="64" height="52" viewBox="0 0 64 52" aria-hidden="true">
          <rect x="2" y="6" width="60" height="44" rx="10" fill="#ffb020" />
          <path d="M6 12l26 20 26-20" fill="none" stroke="#17142b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="54" cy="8" r="7" fill="#5a3df0" stroke="#fff2d4" strokeWidth="3" />
        </svg>
        <h1 className="font-display mt-4 text-[34px] leading-[1.02] font-extrabold">Check your email</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-soft">
          We sent a 6-digit code to <span className="font-bold text-ink">{masked}</span>, from KNOT. Type it below, or tap
          &ldquo;Sign in to KNOT&rdquo; in the email on this phone.
        </p>
      </div>

      <div className="mt-6 rounded-[28px] bg-card p-5">
        <p className="text-[14px] text-soft">Using KNOT from your home screen? Type the code here: links open in your browser.</p>
        <div className="mt-3">
          <VerifyForm email={email} />
        </div>
      </div>

      <div className="mt-5 rounded-[24px] bg-card p-5 text-[14px] leading-relaxed text-soft">
        <p className="font-bold text-ink">Can&apos;t find the email?</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>
            Look in <span className="font-semibold text-ink">Spam</span> and <span className="font-semibold text-ink">Promotions</span>, or search your mail for{" "}
            <span className="font-semibold text-ink">KNOT</span>. The sender&apos;s name is KNOT.
          </li>
          <li>
            Found it in Spam? Tap <span className="font-semibold text-ink">Not spam</span>, so the next one lands in your inbox.
          </li>
          <li>Still nothing after a minute? Send a new code above.</li>
          <li>
            Some IITGN inboxes block outside mail. If nothing arrives in 5 minutes, you&apos;ll get a code from Pritam&apos;s IITGN address
            instead.
          </li>
        </ul>
      </div>

      <p className="mt-6 text-center text-[14px] text-muted">
        Wrong email?{" "}
        <Link href="/" className="font-bold text-thread underline underline-offset-2">
          Start again
        </Link>
      </p>
    </main>
  );
}
