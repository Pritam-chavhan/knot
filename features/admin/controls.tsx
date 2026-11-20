"use client";

import { useActionState } from "react";
import { eventAction, resolveProposal, setRole, setStatus, type AdminActionState } from "./actions";

function Feedback({ s }: { s: AdminActionState }) {
  if (s.error) return <p role="alert" className="mt-2 text-[13px] font-medium text-warn">{s.error}</p>;
  if (s.ok) return <p role="status" className="mt-2 text-[13px] font-semibold text-river-deep">{s.ok}</p>;
  return null;
}

const btn = "min-h-11 rounded-full px-4 text-[13px] font-bold disabled:opacity-50";

export function PersonControls({ id, status, role, self }: { id: string; status: "active" | "suspended"; role: "student" | "admin"; self: boolean }) {
  const [s1, statusAction, p1] = useActionState<AdminActionState, FormData>(setStatus, {});
  const [s2, roleAction, p2] = useActionState<AdminActionState, FormData>(setRole, {});
  if (self) return <p className="mt-2 text-[13px] text-muted">This is you.</p>;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {status === "active" ? (
          <details className="open:basis-full">
            <summary className={`${btn} inline-flex cursor-pointer list-none items-center border-[1.5px] border-warn/30 text-warn`}>Suspend</summary>
            <form action={statusAction} className="mt-2 flex flex-col gap-2 rounded-2xl bg-paper p-3">
              <input type="hidden" name="profileId" value={id} />
              <input type="hidden" name="status" value="suspended" />
              <label htmlFor={`note-${id}`} className="text-[13px] font-semibold">Reason (only admins see this)</label>
              <input id={`note-${id}`} name="note" maxLength={280} className="h-11 rounded-xl border-[1.5px] border-line bg-card px-3 text-[14px]" />
              <p className="text-[13px] text-soft">They&apos;re signed out and hidden from everyone until you restore them.</p>
              <button type="submit" disabled={p1} className={`${btn} bg-warn text-white`}>{p1 ? "Suspending…" : "Suspend account"}</button>
            </form>
          </details>
        ) : (
          <form action={statusAction}>
            <input type="hidden" name="profileId" value={id} />
            <input type="hidden" name="status" value="active" />
            <button type="submit" disabled={p1} className={`${btn} bg-river-deep text-white`}>{p1 ? "Restoring…" : "Restore account"}</button>
          </form>
        )}
        {status === "active" && (
          <form action={roleAction}>
            <input type="hidden" name="profileId" value={id} />
            <input type="hidden" name="role" value={role === "admin" ? "student" : "admin"} />
            <button type="submit" disabled={p2} className={`${btn} border-[1.5px] border-line bg-card`}>
              {role === "admin" ? "Remove admin" : "Make admin"}
            </button>
          </form>
        )}
      </div>
      <Feedback s={s1} />
      <Feedback s={s2} />
    </div>
  );
}

export function EventControls({ id, status, review }: { id: string; status: string; review: string }) {
  const [s, action, pending] = useActionState<AdminActionState, FormData>(eventAction, {});
  const hidden = review === "rejected";
  const cancelled = status === "cancelled";
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="eventId" value={id} />
      <div className="flex flex-wrap gap-2">
        {(hidden || cancelled) && (
          <button type="submit" name="action" value="restore_event" disabled={pending} className={`${btn} bg-river-deep text-white`}>
            Restore
          </button>
        )}
        {!cancelled && !hidden && (
          <button type="submit" name="action" value="cancel_event" disabled={pending} className={`${btn} border-[1.5px] border-line bg-card`}>
            Cancel event
          </button>
        )}
        {!hidden && (
          <button type="submit" name="action" value="hide_event" disabled={pending} className={`${btn} border-[1.5px] border-warn/30 text-warn`}>
            Hide from students
          </button>
        )}
      </div>
      <Feedback s={s} />
    </form>
  );
}

export function ReviewControls({ id, editHref }: { id: string; editHref: string }) {
  const [s, action, pending] = useActionState<AdminActionState, FormData>(eventAction, {});
  if (s.ok) return <Feedback s={s} />;
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="eventId" value={id} />
      <div className="grid grid-cols-3 gap-2">
        <button type="submit" name="action" value="restore_event" disabled={pending} className={`${btn} bg-thread text-white transition-transform active:scale-95`}>
          Publish
        </button>
        <a href={editHref} className={`${btn} flex items-center justify-center border-[1.5px] border-line bg-card transition-transform active:scale-95`}>
          Edit
        </a>
        <button type="submit" name="action" value="hide_event" disabled={pending} className={`${btn} border-[1.5px] border-warn/30 text-warn transition-transform active:scale-95`}>
          Discard
        </button>
      </div>
      <Feedback s={s} />
    </form>
  );
}

export function ProposalControls({ id, cancel }: { id: string; cancel: boolean }) {
  const [s, action, pending] = useActionState<AdminActionState, FormData>(resolveProposal, {});
  if (s.ok) return <Feedback s={s} />;
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="announcementId" value={id} />
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" name="choice" value="apply" disabled={pending} className={`${btn} ${cancel ? "bg-warn" : "bg-thread"} text-white transition-transform active:scale-95`}>
          {cancel ? "Cancel the event" : "Apply change"}
        </button>
        <button type="submit" name="choice" value="dismiss" disabled={pending} className={`${btn} border-[1.5px] border-line bg-card transition-transform active:scale-95`}>
          Ignore
        </button>
      </div>
      <Feedback s={s} />
    </form>
  );
}
