"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui";
import { fileReport, type ChatActionState } from "./actions";
import { REPORT_REASONS } from "./errors";

type Target = { type: "profile" | "message" | "event"; id: string };

const WHAT = { profile: "profile", message: "message", event: "event" } as const;

export function ReportForm({
  target,
  person,
  onDone,
}: {
  target: Target;
  // The person responsible, if any, so the reporter can block them too.
  person?: { id: string; name: string };
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ChatActionState, FormData>(fileReport, {});
  const id = useId();
  const first = person?.name.split(" ")[0];

  if (state.ok) {
    return (
      <div className="pb-1 text-center" role="status">
        <span aria-hidden="true" className="mx-auto mt-2 flex h-14 w-14 items-center justify-center rounded-full bg-river-tint text-river-deep">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 className="font-display mt-4 text-[22px] font-extrabold">Thanks for telling us</h2>
        <p className="mx-auto mt-2 max-w-[32ch] text-[15px] text-soft">
          The KNOT team will look at it.{first ? ` ${first} won't know you reported them.` : ""}
          {state.ok === "reported_blocked" && ` You've also blocked ${first}.`}
        </p>
        <p className="mx-auto mt-3 max-w-[34ch] text-[13px] text-muted">If you&apos;re in danger right now, call campus security or 112.</p>
        <Button type="button" variant="dark" className="mt-5 w-full" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form action={action}>
      <h2 className="font-display text-[22px] font-extrabold">Report this {WHAT[target.type]}</h2>
      <p className="mt-1 text-[14px] text-soft">
        Only the KNOT team sees reports.
        {target.type === "message" && " They'll see this message and the chat before it."}
      </p>
      <input type="hidden" name="type" value={target.type} />
      <input type="hidden" name="target" value={target.id} />
      {person && <input type="hidden" name="blockPerson" value={person.id} />}

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-semibold">What&apos;s wrong?</legend>
        <div className="flex flex-col gap-2">
          {REPORT_REASONS.map((r) => (
            <label key={r.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[16px] border-[1.5px] border-line px-4 has-[:checked]:border-thread has-[:checked]:bg-thread-tint">
              <input type="radio" name="reason" value={r.id} required className="h-5 w-5 accent-thread" />
              <span className="text-[15px] font-semibold">{r.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={`${id}-d`} className="mt-4 block text-sm font-semibold">
        Anything else we should know? <span className="font-normal text-muted">Optional</span>
      </label>
      <textarea
        id={`${id}-d`}
        name="details"
        maxLength={1000}
        rows={3}
        className="mt-2 w-full resize-none rounded-[18px] border-[1.5px] border-line bg-card px-4 py-3 text-base focus:border-thread focus:outline-none"
      />

      {person && (
        <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3">
          <input type="checkbox" name="alsoBlock" className="h-5 w-5 accent-thread" />
          <span className="text-[15px]">
            Also block {first}
            <span className="block text-[13px] text-muted">You won&apos;t see each other anywhere on KNOT.</span>
          </span>
        </label>
      )}

      {state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-warn">
          {state.error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="dark" className="flex-1" disabled={pending}>
          {pending ? "Sending…" : "Send report"}
        </Button>
      </div>
    </form>
  );
}
