import Link from "next/link";
import { Avatar, ButtonLink } from "@/components/ui";
import { avatarSrc } from "@/lib/avatar";
import { chatTime } from "@/lib/time";
import { RequestButtons } from "./connect-controls";
import { LiveChats } from "./live-chats";
import type { loadChats } from "./queries";

type Data = Awaited<ReturnType<typeof loadChats>>;

export function ChatsView({ data, now = new Date(), live = true }: { data: Data; now?: Date; live?: boolean }) {
  const { chats, requests, planRequests } = data;

  return (
    <main className="px-5 pt-6">
      <h1 className="font-display text-[34px] leading-none font-extrabold">Chats</h1>
      <p className="mt-2 text-[15px] text-soft">People you&apos;ve connected with. Only the two of you can read a chat.</p>

      <Link
        href="/activity"
        className="mt-5 flex min-h-[64px] items-center gap-3.5 rounded-[24px] bg-card px-4 py-3 transition-transform active:scale-[0.99]"
      >
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marigold-tint text-ink">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
            <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Plan requests</span>
          <span className="block truncate text-[13px] text-muted">
            {planRequests === 0 ? "Requests to join your plans, and replies to yours" : planRequests === 1 ? "1 person wants to join your plan" : `${planRequests} people want to join your plans`}
          </span>
        </span>
        {planRequests > 0 && (
          <span className="rounded-full bg-rose px-2.5 py-0.5 text-[13px] font-extrabold text-ink">
            {planRequests}
            <span className="sr-only"> waiting</span>
          </span>
        )}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>

      {requests.length > 0 && (
        <section className="mt-6" aria-labelledby="req-h">
          <h2 id="req-h" className="font-display mb-3 flex items-center gap-2 text-[20px] font-extrabold">
            Want to connect
            <span className="rounded-full bg-rose px-2.5 py-0.5 text-[13px] font-bold text-ink">{requests.length}</span>
          </h2>
          <ul className="flex flex-col gap-3">
            {requests.map((r) => {
              const name = r.display_name ?? "Student";
              return (
                <li key={r.request_id} className="rounded-[26px] bg-card p-4">
                  <Link href={`/people/${r.from_id}`} className="flex items-center gap-3 rounded-2xl transition-transform active:scale-[0.99]">
                    <Avatar name={name} size={52} src={avatarSrc(r.from_id, r.avatar_path)} className="ring-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-bold">{name}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {[r.programme, r.batch_year && `Class of ${r.batch_year}`].filter(Boolean).join(", ") || "View profile"}
                      </span>
                    </span>
                  </Link>
                  {r.note && <p className="mt-3 rounded-[16px] bg-paper px-3.5 py-2.5 text-[15px] leading-snug">{r.note}</p>}
                  <RequestButtons requestId={r.request_id} fromId={r.from_id} className="mt-3" />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6" aria-labelledby="chats-h">
        <h2 id="chats-h" className={requests.length > 0 ? "font-display mb-2 text-[20px] font-extrabold" : "sr-only"}>
          Messages
        </h2>
        {chats.length === 0 ? (
          <div className="rounded-[30px] border-[1.5px] border-dashed border-line px-6 py-8 text-center">
            <p className="font-display text-[22px] font-extrabold">No chats yet</p>
            <p className="mx-auto mt-2 max-w-[32ch] text-[15px] text-soft">
              Open someone&apos;s profile and tap Connect. Try people going to the same events as you.
            </p>
            <ButtonLink href="/discover" variant="ghost" className="mt-5">
              Find events and people
            </ButtonLink>
          </div>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {chats.map((c) => {
              const name = c.display_name ?? "Student";
              const unread = c.unread > 0;
              return (
                <li key={c.connection_id}>
                  <Link
                    href={`/chats/${c.connection_id}`}
                    className="flex items-center gap-3.5 rounded-[22px] px-2 py-2.5 transition-colors hover:bg-card active:scale-[0.99]"
                  >
                    <Avatar name={name} size={54} src={avatarSrc(c.other_id, c.avatar_path)} className="ring-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[17px] ${unread ? "font-extrabold" : "font-bold"}`}>{name}</span>
                        <span className={`shrink-0 text-[12.5px] ${unread ? "font-bold text-thread-deep" : "text-muted"}`}>{chatTime(new Date(c.last_at), now)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[14.5px] ${unread ? "font-semibold text-ink" : "text-muted"}`}>
                          {c.last_body ? `${c.last_from_me ? "You: " : ""}${c.last_body}` : "You're connected. Say hi!"}
                        </span>
                        {unread && (
                          <span className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-thread px-1.5 text-[12px] font-extrabold text-white">
                            {c.unread > 9 ? "9+" : c.unread}
                            <span className="sr-only"> unread</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {live && <LiveChats />}
    </main>
  );
}
