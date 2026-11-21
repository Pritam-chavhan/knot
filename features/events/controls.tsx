"use client";

import { useActionState, useOptimistic } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { avatarSrc } from "@/lib/avatar";
import {
  cancelEvent,
  requestToJoin,
  respondToRequest,
  setParticipation,
  withdrawRequest,
  type ActionState,
} from "./actions";
import type { Person } from "./queries";

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Message({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="mt-3 rounded-2xl bg-warn/10 p-3 text-sm font-medium text-warn">
      {state.error}
    </p>
  );
}

// Interested / Going. Tapping the one you already chose clears it.
export function ParticipationButtons({
  eventId,
  mine,
  full,
  disabled,
}: {
  eventId: string;
  mine: "interested" | "going" | null;
  full: boolean;
  disabled: boolean;
}) {
  // The buttons change the moment they're tapped; the server confirms in the
  // background and they switch back with a message if it refuses.
  const [shown, setShown] = useOptimistic(mine);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const next = String(fd.get("state") ?? "");
    setShown(next === "going" || next === "interested" ? next : null);
    return setParticipation(prev, fd);
  }, {});
  const going = shown === "going";
  const interested = shown === "interested";
  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="submit"
          name="state"
          value={interested ? "" : "interested"}
          aria-pressed={interested}
          disabled={disabled}
          className={`flex h-14 items-center justify-center gap-2 rounded-full text-[16px] font-bold transition-colors disabled:opacity-50 ${
            interested ? "bg-thread text-white" : "border-[1.5px] border-line bg-card text-ink hover:border-thread"
          }`}
        >
          {interested && <Check />} Interested
        </button>
        <button
          type="submit"
          name="state"
          value={going ? "" : "going"}
          aria-pressed={going}
          disabled={disabled || (full && !going)}
          className={`flex h-14 items-center justify-center gap-2 rounded-full text-[16px] font-bold transition-colors disabled:opacity-50 ${
            going ? "bg-marigold text-ink" : "bg-ink text-white hover:bg-black"
          }`}
        >
          {going ? (
            <>
              <Check /> You&apos;re going
            </>
          ) : full ? (
            "Full"
          ) : (
            "I'm going"
          )}
        </button>
      </div>
      <Message state={state} />
    </form>
  );
}

export function VisibilitySwitch({ eventId, visible: saved }: { eventId: string; visible: boolean }) {
  const [visible, setVisible] = useOptimistic(saved);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    setVisible(fd.get("visible") === "on");
    return setParticipation(prev, fd);
  }, {});
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="state" value="going" />
      <button
        type="submit"
        name="visible"
        value={visible ? "off" : "on"}
        role="switch"
        aria-checked={visible}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-paper px-4 text-left text-[15px] font-semibold"
      >
        <span>
          Show me in who&apos;s going
          <span className="block text-[13px] font-normal text-muted">
            {visible ? "Others going can see you." : "You're counted, but your name is hidden."}
          </span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${visible ? "bg-thread" : "bg-line"}`} aria-hidden="true">
          <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${visible ? "translate-x-5" : ""}`} />
        </span>
      </button>
      <Message state={state} />
    </form>
  );
}

export function JoinRequest({ eventId, hostName, status, disabled }: { eventId: string; hostName: string; status: string | null; disabled: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestToJoin, {});
  const [wState, withdraw, wPending] = useActionState<ActionState, FormData>(withdrawRequest, {});

  if (status === "pending")
    return (
      <form action={withdraw} className="rounded-[24px] bg-marigold-tint p-4">
        <input type="hidden" name="eventId" value={eventId} />
        <p className="font-bold">Request sent</p>
        <p className="mt-1 text-[14px] text-soft">{hostName} will let you know. You&apos;ll see it here.</p>
        <button type="submit" disabled={wPending} className="mt-3 min-h-11 text-[14px] font-bold text-ink underline underline-offset-2">
          Withdraw my request
        </button>
        <Message state={wState} />
      </form>
    );
  if (status === "declined")
    return (
      <p className="rounded-[24px] bg-paper p-4 text-[15px] text-soft">
        {hostName} couldn&apos;t fit you in this time. Look for another plan on Discover.
      </p>
    );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor="note" className="text-sm font-semibold">
        A note for {hostName} (optional)
      </label>
      <input
        id="note"
        name="note"
        maxLength={280}
        placeholder="Hi! I play most evenings, happy to join."
        className="h-13 min-h-12 rounded-[18px] border-[1.5px] border-line bg-card px-4 text-base focus:border-thread focus:outline-none"
      />
      <button
        type="submit"
        disabled={disabled || pending}
        className="flex h-14 items-center justify-center rounded-full bg-river-deep text-[16px] font-bold text-white hover:bg-[#085e54] disabled:opacity-50"
      >
        {pending ? "Sending…" : "Ask to join"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function RequestRow({ eventId, id, note, person }: { eventId: string; id: string; note: string | null; person: Person }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(respondToRequest, {});
  const name = person.display_name ?? "A student";
  return (
    <li className="rounded-[20px] bg-paper p-3.5">
      <div className="flex items-center gap-3">
        <Avatar name={name} size={40} src={avatarSrc(person.id, person.avatar_path)} />
        <div className="min-w-0 flex-1">
          <Link href={`/people/${person.id}`} className="block truncate font-bold underline-offset-4 hover:underline">
            {name}
          </Link>
          <p className="truncate text-[13px] text-muted">
            {[person.programme, person.batch_year && `Class of ${person.batch_year}`].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>
      {note && <p className="mt-2 rounded-xl bg-card p-2.5 text-[14px] text-soft">&ldquo;{note}&rdquo;</p>}
      <form action={action} className="mt-3 grid grid-cols-2 gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="requestId" value={id} />
        <button type="submit" name="accept" value="no" disabled={pending} className="min-h-11 rounded-full border-[1.5px] border-line bg-card text-[14px] font-bold">
          Not this time
        </button>
        <button type="submit" name="accept" value="yes" disabled={pending} className="min-h-11 rounded-full bg-river-deep text-[14px] font-bold text-white">
          Let {name.split(" ")[0]} in
        </button>
      </form>
      <Message state={state} />
    </li>
  );
}

export function HostPanel({
  eventId,
  requests,
  canCancel,
}: {
  eventId: string;
  requests: { id: string; note: string | null; person: Person }[];
  canCancel: boolean;
}) {
  const [state, cancel, pending] = useActionState<ActionState, FormData>(cancelEvent, {});
  return (
    <section className="rounded-[28px] bg-card p-5" aria-labelledby="host-h">
      <h2 id="host-h" className="font-display text-[20px] font-extrabold">
        You&apos;re hosting
      </h2>
      {requests.length > 0 ? (
        <>
          <p className="mt-1 text-[14px] text-soft">
            {requests.length === 1 ? "1 person wants to join." : `${requests.length} people want to join.`}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {requests.map((r) => (
              <RequestRow key={r.id} eventId={eventId} {...r} />
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-[14px] text-soft">Share the link with friends. New requests to join show up here.</p>
      )}
      {canCancel && (
        <details className="mt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-[14px] font-bold text-warn">Cancel this plan</summary>
          <form action={cancel} className="mt-2 flex flex-col gap-3">
            <input type="hidden" name="eventId" value={eventId} />
            <label className="flex min-h-11 items-center gap-3 text-[14px]">
              <input type="checkbox" name="confirm" value="yes" className="h-5 w-5 accent-warn" />
              Everyone going will see it&apos;s cancelled.
            </label>
            <button type="submit" disabled={pending} className="min-h-12 rounded-full border-[1.5px] border-warn/30 text-[15px] font-bold text-warn">
              {pending ? "Cancelling…" : "Cancel plan"}
            </button>
            <Message state={state} />
          </form>
        </details>
      )}
    </section>
  );
}
