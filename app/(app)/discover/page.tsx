import { requireMember } from "@/lib/auth";
import { Card } from "@/components/ui";

export default async function Discover() {
  const { profile } = await requireMember();
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <main className="px-5 pt-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{today}</p>
      <h1 className="mt-1 font-serif text-[34px] leading-tight">
        Hi {profile.display_name}. <em>What&apos;s on?</em>
      </h1>
      <Card className="mt-6">
        <h2 className="font-serif text-2xl">Events are on their way</h2>
        <p className="mt-2 text-sm text-soft">
          You&apos;re in. The campus event feed opens here shortly. Next you&apos;ll be able to say you&apos;re going, see
          who else is, and host your own.
        </p>
      </Card>
    </main>
  );
}
