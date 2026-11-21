"use client";

import { useActionState, useId, useState } from "react";
import { Button, ButtonLink } from "@/components/ui";
import { cancelConnectionRequest, respondConnectionRequest, sendConnectionRequest, type ChatActionState } from "./actions";
import type { Relationship } from "./queries";
import { Sheet } from "./sheet";

function Err({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-2 text-sm font-medium text-warn">
      {msg}
    </p>
  ) : null;
}

// The main button on someone's profile: Connect, Requested, Accept or Message.
export function ConnectControls({ person, relationship }: { person: { id: string; name: string }; relationship: Relationship }) {
  const first = person.name.split(" ")[0];

  switch (relationship.state) {
    case "connected":
      return (
        <ButtonLink href={`/chats/${relationship.connection_id}`} className="w-full">
          <ChatIcon /> Message {first}
        </ButtonLink>
      );
    case "incoming":
      return <IncomingRequest person={person} first={first} requestId={relationship.request_id} />;
    case "requested":
      return <Requested person={person} first={first} />;
    case "none":
      return <Connect person={person} first={first} />;
    case "closed":
      return <p className="rounded-[20px] bg-card px-4 py-3.5 text-center text-[14px] text-soft">{first} isn&apos;t taking connection requests right now.</p>;
    default:
      return null;
  }
}

function Connect({ person, first }: { person: { id: string }; first: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ChatActionState, FormData>(sendConnectionRequest, {});
  const id = useId();
  return (
    <>
      <Button type="button" className="w-full" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <PlusIcon /> Connect
      </Button>
      <p className="mt-2 text-center text-[13px] text-muted">Once {first} accepts, you can chat.</p>
      <Sheet open={open} onClose={() => setOpen(false)} label={`Connect with ${first}`}>
        <form action={action}>
          <h2 className="font-display text-[22px] font-extrabold">Connect with {first}</h2>
          <p className="mt-1 text-[14px] text-soft">They&apos;ll see your profile and your note. Chat opens once they accept.</p>
          <input type="hidden" name="to" value={person.id} />
          <label htmlFor={id} className="mt-4 block text-sm font-semibold">
            Add a note <span className="font-normal text-muted">Optional</span>
          </label>
          <textarea
            id={id}
            name="note"
            maxLength={140}
            rows={3}
            placeholder="Saw you're going to the Blithchron jam too!"
            className="mt-2 w-full resize-none rounded-[18px] border-[1.5px] border-line bg-card px-4 py-3 text-base placeholder:text-muted/80 focus:border-thread focus:outline-none"
          />
          <Err msg={state.error} />
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

function Requested({ person, first }: { person: { id: string }; first: string }) {
  const [state, action, pending] = useActionState<ChatActionState, FormData>(cancelConnectionRequest, {});
  return (
    <form action={action}>
      <input type="hidden" name="to" value={person.id} />
      <div className="flex items-center gap-2 rounded-[22px] bg-card p-1.5 pl-4">
        <span className="flex flex-1 items-center gap-2 text-[15px] font-bold text-thread-deep">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Request sent
        </span>
        <button type="submit" disabled={pending} className="min-h-11 rounded-full px-4 text-[14px] font-bold text-soft transition-colors hover:bg-paper disabled:opacity-60">
          {pending ? "Cancelling…" : "Cancel"}
        </button>
      </div>
      <p className="mt-2 text-center text-[13px] text-muted">You can chat once {first} accepts.</p>
      <Err msg={state.error} />
    </form>
  );
}

function IncomingRequest({ person, first, requestId }: { person: { id: string }; first: string; requestId: string }) {
  return (
    <div className="rounded-[24px] bg-thread-tint p-4">
      <p className="font-bold text-thread-deep">{first} wants to connect</p>
      <RequestButtons requestId={requestId} fromId={person.id} open className="mt-3" />
    </div>
  );
}

// Accept and Decline, used on profiles and in the Chats list.
export function RequestButtons({ requestId, fromId, open = false, className = "" }: { requestId: string; fromId: string; open?: boolean; className?: string }) {
  const [state, action, pending] = useActionState<ChatActionState, FormData>(respondConnectionRequest, {});
  return (
    <form action={action} className={className}>
      <input type="hidden" name="request" value={requestId} />
      <input type="hidden" name="from" value={fromId} />
      {open && <input type="hidden" name="open" value="1" />}
      <div className="flex gap-2">
        <Button type="submit" name="accept" value="1" className="h-11 min-h-11 flex-1 text-[15px]" disabled={pending}>
          Accept
        </Button>
        <Button type="submit" name="accept" value="0" variant="ghost" className="h-11 min-h-11 flex-1 text-[15px]" disabled={pending}>
          Decline
        </Button>
      </div>
      <Err msg={state.error} />
    </form>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChatIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4 19.5l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z" />
    </svg>
  );
}
