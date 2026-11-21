import Link from "next/link";
import { Avatar, ButtonLink } from "@/components/ui";
import { BackButton } from "@/components/back-button";
import { ProfileLinks } from "@/features/profile/profile-links";
import { avatarSrc } from "@/lib/avatar";
import { whenLabel } from "@/lib/time";
import { ConnectControls } from "@/features/chat/connect-controls";
import { PersonMenu } from "@/features/chat/person-menu";
import type { Relationship } from "@/features/chat/queries";
import type { loadPerson, PlanRow } from "./queries";

type Data = NonNullable<Awaited<ReturnType<typeof loadPerson>>>;

export function PersonView({ data, relationship }: { data: Data; relationship: Relationship }) {
  const { person: p, isMe, interests, hosting, going } = data;
  const name = p.display_name ?? "Student";
  const first = name.split(" ")[0];
  const shared = interests.filter((i) => i.shared).length;

  return (
    <main className="px-5 pt-5">
      <div className="flex items-center justify-between">
        <BackButton />
        {isMe ? (
          <Link href="/profile" className="flex min-h-11 items-center rounded-full bg-card px-4 text-[14px] font-bold text-thread-deep transition-transform active:scale-95">
            Edit profile
          </Link>
        ) : (
          <PersonMenu
            person={{ id: p.id, name }}
            reportTarget={{ type: "profile", id: p.id }}
            connected={relationship.state === "connected"}
            from="profile"
          />
        )}
      </div>

      {isMe && (
        <p className="mt-4 rounded-2xl bg-thread-tint px-4 py-3 text-[14px] font-medium text-thread-deep">This is how other students see your profile.</p>
      )}

      <section className="relative mt-4 overflow-hidden rounded-[32px] bg-ink px-6 pt-7 pb-6 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-14 h-48 w-48 rounded-full border-[14px] border-thread/50" />
        <div aria-hidden="true" className="pointer-events-none absolute -top-6 right-10 h-20 w-20 rounded-full border-[10px] border-marigold/70" />
        <Avatar name={name} size={104} index={0} src={avatarSrc(p.id, p.avatar_path)} className="relative ring-ink" />
        <h1 className="font-display relative mt-4 text-[32px] leading-[1.05] font-extrabold">{name}</h1>
        <p className="relative mt-1 text-[15px] text-white/75">
          {[p.programme, p.batch_year && `Class of ${p.batch_year}`].filter(Boolean).join(", ")}
        </p>
        {p.bio && <p className="relative mt-4 text-[16px] leading-relaxed text-white/90">{p.bio}</p>}
        <ProfileLinks profile={p} tone="dark" />
        {(p.github || p.instagram || p.linkedin) && <p className="relative mt-3 text-[12px] text-white/60">Links are added by {isMe ? "you" : first} and not verified by KNOT.</p>}
      </section>

      {!isMe && (
        <div className="mt-4">
          <ConnectControls person={{ id: p.id, name }} relationship={relationship} />
        </div>
      )}

      {interests.length > 0 && (
        <section className="mt-4 rounded-[28px] bg-card p-5" aria-labelledby="int-h">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="int-h" className="font-display text-[20px] font-extrabold">
              Interests
            </h2>
            {shared > 0 && (
              <p className="text-[13px] font-bold text-thread-deep">
                {shared === 1 ? "1 in common with you" : `${shared} in common with you`}
              </p>
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {interests.map((i) => (
              <li
                key={i.id}
                className={`rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${i.shared ? "bg-marigold text-ink" : "bg-paper text-soft"}`}
              >
                {i.shared && <span className="sr-only">In common: </span>}
                {i.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <PlanList title={isMe ? "You're hosting" : `${first} is hosting`} rows={hosting} tone="host" />
      <PlanList title={isMe ? "You're going to" : `${first} is going to`} rows={going} tone="going" />

      {hosting.length === 0 && going.length === 0 && (
        <section className="mt-4 rounded-[28px] border-[1.5px] border-dashed border-line p-5 text-center">
          <p className="font-bold">{isMe ? "No plans on your profile yet" : `No plans shared by ${first} yet`}</p>
          <p className="mt-1 text-[14px] text-soft">
            {isMe ? "Plans you host, and events you're going to with your name shown, appear here." : "Find something on Discover and you might run into each other."}
          </p>
          <ButtonLink href={isMe ? "/host/new" : "/discover"} variant="ghost" className="mt-4">
            {isMe ? "Host a plan" : "Browse events"}
          </ButtonLink>
        </section>
      )}
    </main>
  );
}

function PlanList({ title, rows, tone }: { title: string; rows: PlanRow[]; tone: "host" | "going" }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-4 rounded-[28px] bg-card p-5" aria-label={title}>
      <h2 className="font-display text-[20px] font-extrabold">{title}</h2>
      <ul className="mt-2 flex flex-col">
        {rows.map((e) => (
          <li key={e.id}>
            <Link href={`/events/${e.id}`} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-paper active:scale-[0.99]">
              <span aria-hidden="true" className={`h-10 w-1.5 shrink-0 rounded-full ${tone === "host" ? "bg-marigold" : "bg-thread"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{e.title}</span>
                <span className="block truncate text-[13px] text-muted">{[whenLabel(new Date(e.starts_at)), e.venue].filter(Boolean).join(", ")}</span>
              </span>
              {e.status === "full" && <span className="rounded-full bg-paper px-2.5 py-1 text-[12px] font-bold text-soft">Full</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
