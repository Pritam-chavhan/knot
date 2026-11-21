"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Avatar } from "@/components/ui";
import { sendConnectionRequest, type ChatActionState } from "@/features/chat/actions";
import type { PersonCardData } from "./directory-queries";

const BANDS = ["bg-thread", "bg-marigold", "bg-river", "bg-rose", "bg-ink"];

function band(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BANDS[h % BANDS.length];
}

// Why this person: the strongest shared thing, in a few words.
export function reason(p: PersonCardData): string | null {
  if (p.state === "incoming") return "Wants to connect with you";
  if (p.sharedInterests.length >= 2) return `You both like ${p.sharedInterests[0]} and ${p.sharedInterests[1]}`;
  if (p.sharedInterests.length === 1) return `You both like ${p.sharedInterests[0]}`;
  if (p.mutual > 0) return p.mutual === 1 ? "1 mutual connection" : `${p.mutual} mutual connections`;
  if (p.sharedPlans > 0) return p.sharedPlans === 1 ? "Going to a plan you're in" : `In ${p.sharedPlans} of your plans`;
  return null;
}

function subtitle(p: PersonCardData) {
  const batch = p.batch ? `'${String(p.batch).slice(-2)}` : null;
  return [p.programme, batch].filter(Boolean).join(" · ") || "IITGN";
}

export function PersonCard({ person }: { person: PersonCardData }) {
  const why = reason(person);
  return (
    <li className="relative flex flex-col overflow-hidden rounded-[24px] bg-card text-center">
      <span aria-hidden="true" className={`h-12 ${band(person.id)}`} />
      <Link href={`/people/${person.id}`} className="flex flex-1 flex-col items-center px-3 pb-3 after:absolute after:inset-0 after:content-['']">
        <Avatar name={person.name} size={64} src={person.avatar} className="-mt-8 ring-4 ring-card" />
        <span className="mt-2 line-clamp-1 text-[15.5px] leading-tight font-extrabold">{person.name}</span>
        <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{subtitle(person)}</span>
        <span className="mt-2 line-clamp-2 min-h-[2.6em] text-[12.5px] leading-snug font-semibold text-thread">{why ?? person.bio ?? "New on KNOT"}</span>
      </Link>
      <div className="relative z-10 px-3 pb-3">
        <CardAction person={person} />
      </div>
    </li>
  );
}

function CardAction({ person }: { person: PersonCardData }) {
  const [state, action, pending] = useActionState<ChatActionState, FormData>(sendConnectionRequest, {});
  const sent = state.ok === "requested" || state.ok === "pending" || state.ok === "connected";
  const pill = "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full text-[14px] font-bold transition-transform active:scale-[0.97]";

  if (person.state === "connected" || state.ok === "connected") {
    return (
      <Link href={`/people/${person.id}`} className={`${pill} border-[1.5px] border-line`}>
        Message
      </Link>
    );
  }
  if (person.state === "incoming") {
    return (
      <Link href={`/people/${person.id}`} className={`${pill} bg-marigold text-ink`}>
        Respond
      </Link>
    );
  }
  if (person.state === "requested" || sent) {
    return (
      <span className={`${pill} bg-paper text-muted`} aria-live="polite">
        Requested
      </span>
    );
  }
  if (person.state !== "none") {
    return (
      <Link href={`/people/${person.id}`} className={`${pill} border-[1.5px] border-line`}>
        View
      </Link>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="to" value={person.id} />
      <button type="submit" disabled={pending} className={`${pill} bg-thread text-white disabled:opacity-60`}>
        {pending ? (
          "Sending…"
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Connect
          </>
        )}
      </button>
      {state.error && (
        <p role="alert" className="mt-1 text-[12px] font-medium text-warn">
          {state.error}
        </p>
      )}
    </form>
  );
}
