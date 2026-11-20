"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { toIstLocalInput } from "@/lib/time";
import { CATEGORIES } from "./categories";
import { createHostedEvent, createOfficialEvent, type ActionState } from "./actions";

const DURATIONS = [
  { v: "", l: "Not sure" },
  { v: "30", l: "30 min" },
  { v: "60", l: "1 hour" },
  { v: "90", l: "1.5 hours" },
  { v: "120", l: "2 hours" },
  { v: "180", l: "3 hours" },
  { v: "300", l: "5 hours" },
];

function useFocusError(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.field) return;
    const el = ref.current?.querySelector<HTMLElement>(`[name="${state.field}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }, [state]);
  return ref;
}

function CategoryPicker({ value, error }: { value: string; error?: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">What kind of plan?</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <label
            key={c.id}
            className="flex min-h-11 cursor-pointer items-center rounded-full bg-paper px-4 text-[14px] font-semibold text-soft has-[:checked]:bg-thread has-[:checked]:text-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-thread"
          >
            <input type="radio" name="category" value={c.id} defaultChecked={value === c.id} className="sr-only" />
            {c.label}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-warn">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function WhenFields({ v, err }: { v: Record<string, string>; err: (f: string) => string | undefined }) {
  const min = toIstLocalInput(new Date());
  return (
    <div className="flex flex-col gap-5">
      <Field label="When" htmlFor="startsAt" error={err("startsAt")}>
        <input id="startsAt" name="startsAt" type="datetime-local" min={min} defaultValue={v.startsAt ?? ""} required aria-invalid={!!err("startsAt")} className={inputClass} />
      </Field>
      <Field label="How long, roughly" htmlFor="durationMinutes">
        <select id="durationMinutes" name="durationMinutes" defaultValue={v.durationMinutes ?? "60"} className={inputClass}>
          {DURATIONS.map((d) => (
            <option key={d.v} value={d.v}>
              {d.l}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function HostForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createHostedEvent, {});
  const ref = useFocusError(state);
  const v = state.values ?? {};
  const err = (f: string) => (state.field === f ? state.error : undefined);

  return (
    <form ref={ref} key={JSON.stringify(v)} action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-5 rounded-[28px] bg-card p-5">
        <Field label="What's the plan?" htmlFor="title" error={err("title")}>
          <input id="title" name="title" defaultValue={v.title ?? ""} maxLength={120} placeholder="Badminton doubles, need 2 more" required aria-invalid={!!err("title")} className={inputClass} />
        </Field>
        <CategoryPicker value={v.category ?? ""} error={err("category")} />
        <WhenFields v={v} err={err} />
        <Field label="Where to meet" htmlFor="venue" error={err("venue")}>
          <input id="venue" name="venue" defaultValue={v.venue ?? ""} maxLength={120} placeholder="Sports complex, court 2" required aria-invalid={!!err("venue")} className={inputClass} />
        </Field>
      </div>

      <div className="flex flex-col gap-5 rounded-[28px] bg-card p-5">
        <Field label="How many people in total, including you?" htmlFor="capacity" hint="Leave empty for no limit." error={err("capacity")}>
          <input id="capacity" name="capacity" type="number" inputMode="numeric" min={2} max={500} defaultValue={v.capacity ?? ""} placeholder="No limit" aria-invalid={!!err("capacity")} className={inputClass} />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Who can join?</legend>
          <div className="mt-2 grid gap-2">
            {[
              { id: "open", t: "Anyone at IITGN", d: "People tap Going and they're in, until it's full." },
              { id: "request", t: "I'll let people in", d: "People ask to join, and you say yes or no." },
            ].map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer gap-3 rounded-[20px] border-[1.5px] border-line p-4 has-[:checked]:border-thread has-[:checked]:bg-thread-tint has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-thread"
              >
                <input type="radio" name="joinMode" value={o.id} defaultChecked={(v.joinMode ?? "open") === o.id} className="mt-1 h-5 w-5 accent-thread" />
                <span>
                  <span className="block font-bold">{o.t}</span>
                  <span className="text-[14px] text-soft">{o.d}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Anything else to know? (optional)" htmlFor="description" error={err("description")}>
          <textarea id="description" name="description" defaultValue={v.description ?? ""} maxLength={1000} rows={3} placeholder="Bring your own racquet. Shuttles on me." className={`${inputClass} h-auto py-3`} />
        </Field>
      </div>

      {state.error && !state.field && (
        <p role="alert" className="rounded-2xl bg-warn/10 p-3.5 text-sm font-medium text-warn">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-14">
        {pending ? "Posting your plan…" : "Post plan"}
      </Button>
      <p className="text-center text-[13px] text-muted">Everyone at IITGN on KNOT can see it. You&apos;ll be marked as going.</p>
    </form>
  );
}

export function AdminEventForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createOfficialEvent, {});
  const ref = useFocusError(state);
  const v = state.values ?? {};
  const err = (f: string) => (state.field === f ? state.error : undefined);

  return (
    <form ref={ref} key={JSON.stringify(v)} action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-5 rounded-[28px] bg-card p-5">
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Label it as</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { id: "official", t: "Official", d: "From the institute" },
              { id: "community", t: "Club", d: "From a club or society" },
            ].map((o) => (
              <label key={o.id} className="flex cursor-pointer gap-3 rounded-[20px] border-[1.5px] border-line p-3.5 has-[:checked]:border-thread has-[:checked]:bg-thread-tint">
                <input type="radio" name="source" value={o.id} defaultChecked={(v.source ?? "official") === o.id} className="mt-1 h-5 w-5 accent-thread" />
                <span>
                  <span className="block font-bold">{o.t}</span>
                  <span className="text-[13px] text-soft">{o.d}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Event name" htmlFor="title" error={err("title")}>
          <input id="title" name="title" defaultValue={v.title ?? ""} maxLength={120} required aria-invalid={!!err("title")} className={inputClass} />
        </Field>
        <CategoryPicker value={v.category ?? ""} error={err("category")} />
        <WhenFields v={v} err={err} />
        <Field label="Venue" htmlFor="venue" error={err("venue")}>
          <input id="venue" name="venue" defaultValue={v.venue ?? ""} maxLength={120} required aria-invalid={!!err("venue")} className={inputClass} />
        </Field>
        <Field label="Organised by (optional)" htmlFor="organiser" error={err("organiser")}>
          <input id="organiser" name="organiser" defaultValue={v.organiser ?? ""} maxLength={120} placeholder="Robotics Club" className={inputClass} />
        </Field>
        <Field label="Registration link (optional)" htmlFor="registrationUrl" error={err("registrationUrl")}>
          <input id="registrationUrl" name="registrationUrl" type="url" inputMode="url" defaultValue={v.registrationUrl ?? ""} placeholder="https://" aria-invalid={!!err("registrationUrl")} className={inputClass} />
        </Field>
        <Field label="Description (optional)" htmlFor="description" error={err("description")}>
          <textarea id="description" name="description" defaultValue={v.description ?? ""} maxLength={4000} rows={5} className={`${inputClass} h-auto py-3`} />
        </Field>
      </div>
      {state.error && !state.field && (
        <p role="alert" className="rounded-2xl bg-warn/10 p-3.5 text-sm font-medium text-warn">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-14">
        {pending ? "Adding…" : "Add to the feed"}
      </Button>
    </form>
  );
}
