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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-7 pb-8">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full border border-line">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <Logo />
      </header>
      <h1 className="mt-10 font-serif text-[42px] leading-none">
        Check your <em>inbox</em>.
      </h1>
      <p className="mt-3 text-base text-soft">
        We sent a 6-digit code to <span className="font-semibold text-ink">{masked}</span>. It expires in an hour.
      </p>
      <div className="mt-8">
        <VerifyForm email={email} />
      </div>
      <p className="mt-6 text-sm text-muted">
        Didn&apos;t get it? Check spam, or{" "}
        <Link href="/" className="font-semibold text-ink underline">
          send a new code
        </Link>
        .
      </p>
    </main>
  );
}
