"use client";

import { useActionState, useState } from "react";
import { saveProfile, type ProfileFormState } from "./actions";
import { Button, Field, Toggle, inputClass } from "@/components/ui";

type Interest = { id: number; name: string };

export function ProfileForm({
  interests,
  initial,
  submitLabel,
}: {
  interests: Interest[];
  initial: {
    displayName: string;
    programme: string;
    batchYear: number | null;
    bio: string;
    interestIds: number[];
    showGoing: boolean;
  };
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const [picked, setPicked] = useState<number[]>(initial.interestIds);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => thisYear - 6 + i);

  const toggle = (id: number) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 8 ? p : [...p, id]));

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-5 rounded-[28px] bg-card p-5">
      <Field label="Your name" htmlFor="displayName" hint="First name is fine. This is what other students see.">
        <input id="displayName" name="displayName" defaultValue={initial.displayName} maxLength={40} required className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Programme" htmlFor="programme">
          <input id="programme" name="programme" defaultValue={initial.programme} placeholder="BTech CSE" maxLength={60} required className={inputClass} />
        </Field>
        <Field label="Graduating in" htmlFor="batchYear">
          <select id="batchYear" name="batchYear" defaultValue={initial.batchYear ?? thisYear + 2} className={inputClass}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="A line about you (optional)" htmlFor="bio">
        <textarea id="bio" name="bio" defaultValue={initial.bio} maxLength={280} rows={2} placeholder="Building a line follower. Always up for chai." className={`${inputClass} h-auto py-3`} />
      </Field>

      </div>

      <fieldset className="rounded-[28px] bg-card p-5">
        <legend className="sr-only">Interests</legend>
        <div className="flex items-baseline justify-between" aria-hidden="true">
          <span className="text-sm font-semibold text-ink">Your interests</span>
          <span className={`text-[13px] font-bold ${picked.length >= 8 ? "text-thread" : "text-muted"}`}>{picked.length} of 8</span>
        </div>
        <p className="mt-1 text-[13px] text-muted">Pick a few. We use them to show you people you&apos;d get along with.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {interests.map((i) => {
            const on = picked.includes(i.id);
            return (
              <label
                key={i.id}
                className={`cursor-pointer rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-thread ${
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

      <div className="rounded-[28px] bg-card p-5">
        <Toggle
          name="showGoing"
          defaultChecked={initial.showGoing}
          title="Show me to others going"
          description="People going to the same event can see you. You can change this for any event."
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-warn">
          {state.error}
        </p>
      )}
      {state.saved && <p className="text-sm font-semibold text-river-deep">Profile saved.</p>}
      <Button type="submit" disabled={pending} className="h-14">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
