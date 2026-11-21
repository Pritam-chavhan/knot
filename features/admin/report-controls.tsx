"use client";

import { useActionState, useId } from "react";
import { resolveReport, type AdminActionState } from "./actions";

const btn = "min-h-11 rounded-full px-4 text-[13px] font-bold transition-transform active:scale-95 disabled:opacity-50";

export function ReportControls({
  reportId,
  subjectName,
  canSuspend,
  protectedSubject,
  canHide,
}: {
  reportId: string;
  subjectName: string | null;
  canSuspend: boolean;
  protectedSubject: boolean;
  canHide: boolean;
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(resolveReport, {});
  const id = useId();

  if (state.ok) {
    return (
      <p role="status" className="mt-3 text-[13px] font-semibold text-river-deep">
        {state.ok}
      </p>
    );
  }

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="reportId" value={reportId} />
      <label htmlFor={`${id}-n`} className="text-[13px] font-semibold">
        Note for the admin log <span className="font-normal text-muted">Optional</span>
      </label>
      <input id={`${id}-n`} name="note" maxLength={280} className="mt-1.5 h-11 w-full rounded-xl border-[1.5px] border-line bg-card px-3 text-[14px] focus:border-thread focus:outline-none" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" name="action" value="dismiss" disabled={pending} className={`${btn} border-[1.5px] border-line bg-card`}>
          Dismiss
        </button>
        {canHide && (
          <button type="submit" name="action" value="hide_event" disabled={pending} className={`${btn} bg-ink text-white`}>
            Hide event
          </button>
        )}
        {canSuspend && (
          <button type="submit" name="action" value="suspend_user" disabled={pending} className={`${btn} bg-warn text-white`}>
            Suspend {subjectName ?? "them"}
          </button>
        )}
      </div>
      {canSuspend && <p className="mt-2 text-[12.5px] text-muted">Suspending signs them out, hides them from everyone and closes every open report about them.</p>}
      {protectedSubject && <p className="mt-2 text-[12.5px] text-muted">{subjectName ?? "This person"} is an admin. Remove their admin role first if needed.</p>}
      {state.error && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-warn">
          {state.error}
        </p>
      )}
    </form>
  );
}
