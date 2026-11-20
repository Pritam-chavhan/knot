"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveProfile, type ProfileField, type ProfileFormState } from "./actions";
import { Button, Field, Toggle, inputClass } from "@/components/ui";
import { LINKS, LINK_KINDS } from "./links";

type Interest = { id: number; name: string };
type Initial = {
  displayName: string;
  programme: string;
  batchYear: number | null;
  bio: string;
  interestIds: number[];
  showGoing: boolean;
  github: string;
  instagram: string;
  linkedin: string;
};

const MAX = 8;

export function ProfileForm({ interests, initial, submitLabel }: { interests: Interest[]; initial: Initial; submitLabel: string }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => thisYear - 6 + i);

  // After a failed save, refill the form with what was submitted.
  const v = state.values;
  const values = {
    displayName: v?.displayName ?? initial.displayName,
    programme: v?.programme ?? initial.programme,
    batchYear: v?.batchYear ?? String(initial.batchYear ?? thisYear + 2),
    bio: v?.bio ?? initial.bio,
    interestIds: v?.interests ?? initial.interestIds,
    showGoing: v?.showGoing ?? initial.showGoing,
    github: v?.github ?? initial.github,
    instagram: v?.instagram ?? initial.instagram,
    linkedin: v?.linkedin ?? initial.linkedin,
  };
  const hasLinks = LINK_KINDS.some((k) => values[k]) || LINK_KINDS.some((k) => state.field === k);
  const [picked, setPicked] = useState<number[]>(values.interestIds);
  const formRef = useRef<HTMLFormElement>(null);

  // Put focus on the field that needs fixing, so it's never off-screen.
  useEffect(() => {
    if (!state.field) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${state.field}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }, [state]);

  const err = (f: ProfileField) => (state.field === f ? state.error : undefined);
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id]));
  const formKey = v ? JSON.stringify(v) : "initial";

  return (
    <form ref={formRef} key={formKey} action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-5 rounded-[28px] bg-card p-5">
        <Field label="Your name" htmlFor="displayName" hint="First name is fine. This is what other students see." error={err("displayName")}>
          <input
            id="displayName"
            name="displayName"
            data-field="displayName"
            defaultValue={values.displayName}
            maxLength={40}
            autoComplete="given-name"
            required
            aria-invalid={!!err("displayName")}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <Field label="Programme" htmlFor="programme" error={err("programme")}>
            <input
              id="programme"
              name="programme"
              data-field="programme"
              defaultValue={values.programme}
              placeholder="BTech CSE"
              maxLength={60}
              required
              aria-invalid={!!err("programme")}
              className={inputClass}
            />
          </Field>
          <Field label="Graduating in" htmlFor="batchYear" error={err("batchYear")}>
            <select id="batchYear" name="batchYear" data-field="batchYear" defaultValue={values.batchYear} className={inputClass}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="A line about you (optional)" htmlFor="bio" hint="What you're into, building or always up for." error={err("bio")}>
          <textarea
            id="bio"
            name="bio"
            data-field="bio"
            defaultValue={values.bio}
            maxLength={280}
            rows={2}
            placeholder="Building a line follower. Always up for chai at Tea Post."
            aria-invalid={!!err("bio")}
            className={`${inputClass} h-auto py-3`}
          />
        </Field>
      </div>

      <fieldset className="rounded-[28px] bg-card p-5" data-field="interests" tabIndex={-1} aria-describedby="interests-help">
        <legend className="sr-only">Your interests</legend>
        <div className="flex items-baseline justify-between" aria-hidden="true">
          <span className="text-sm font-semibold text-ink">Your interests</span>
          <span className={`text-[13px] font-bold tabular-nums ${picked.length >= MAX ? "text-thread" : "text-muted"}`}>
            {picked.length} of {MAX}
          </span>
        </div>
        <p id="interests-help" className="mt-1 text-[13px] text-muted">
          {picked.length >= MAX ? "That's the most you can pick. Tap one to swap it." : "Pick a few. They help you find people you'd get along with."}
        </p>
        {err("interests") && (
          <p role="alert" className="mt-2 text-sm font-medium text-warn">
            {err("interests")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {interests.map((i) => {
            const on = picked.includes(i.id);
            return (
              <label
                key={i.id}
                className={`flex min-h-11 cursor-pointer items-center rounded-full px-4 text-[14px] font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-thread ${
                  on ? "bg-thread text-white" : "bg-paper text-soft hover:bg-thread-tint"
                }`}
              >
                <input type="checkbox" name="interests" value={i.id} checked={on} onChange={() => toggle(i.id)} className="sr-only" />
                {i.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <details open={hasLinks} className="group rounded-[28px] bg-card p-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-semibold">Your links</span>
            <span className="text-[13px] text-muted">Optional. GitHub, Instagram, LinkedIn.</span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted transition-transform group-open:rotate-180">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          {LINK_KINDS.map((k) => (
            <Field key={k} label={LINKS[k].label} htmlFor={k} error={err(k)}>
              <div className={`flex items-stretch overflow-hidden rounded-[18px] border-[1.5px] bg-paper focus-within:border-thread ${err(k) ? "border-warn" : "border-line"}`}>
                <span className="flex items-center pl-4 text-[14px] text-muted select-none" aria-hidden="true">
                  {LINKS[k].prefix}
                </span>
                <input
                  id={k}
                  name={k}
                  data-field={k}
                  defaultValue={values[k]}
                  placeholder="username"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="url"
                  maxLength={200}
                  aria-invalid={!!err(k)}
                  aria-describedby="links-hint"
                  className="h-12 min-w-0 flex-1 bg-transparent pr-4 pl-0.5 text-[16px] outline-none"
                />
              </div>
            </Field>
          ))}
          <p id="links-hint" className="text-[13px] text-muted">
            Paste your profile link or type the username. Only IITGN students on KNOT can see these.
          </p>
        </div>
      </details>

      <div className="rounded-[28px] bg-card p-5">
        <Toggle
          name="showGoing"
          defaultChecked={values.showGoing}
          title="Show me to others going"
          description="People going to the same event can see you. You can change this for any event."
        />
      </div>

      <div aria-live="polite">
        {state.error && !state.field && (
          <p role="alert" className="rounded-2xl bg-warn/10 p-3.5 text-sm font-medium text-warn">
            {state.error}
          </p>
        )}
        {state.saved && <p className="rounded-2xl bg-river-tint p-3.5 text-sm font-semibold text-river-deep">Profile saved.</p>}
      </div>
      <Button type="submit" disabled={pending} className="h-14">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
