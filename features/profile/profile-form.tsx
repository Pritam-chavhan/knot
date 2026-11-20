"use client";

import { useActionState, useState } from "react";
import { saveProfile, type ProfileFormState } from "./actions";
import { Button, Field, inputClass } from "@/components/ui";

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
    <form action={action} className="flex flex-col gap-6" noValidate>
      <Field label="Your name" htmlFor="displayName" hint="First name is fine. This is what other students see.">
        <input id="displayName" name="displayName" defaultValue={initial.displayName} maxLength={40} required className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Programme" htmlFor="programme">
          <input id="programme" name="programme" defaultValue={initial.programme} placeholder="BTech CSE" maxLength={60} required className={inputClass} />
        </Field>
        <Field label="Batch (graduating year)" htmlFor="batchYear">
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

      <fieldset>
        <legend className="text-sm font-medium text-soft">Interests · {picked.length} of 8</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {interests.map((i) => {
            const on = picked.includes(i.id);
            return (
              <label
                key={i.id}
                className={`cursor-pointer rounded-full px-3.5 py-2 text-sm transition-colors ${
                  on ? "bg-ink text-paper" : "border border-line text-soft hover:bg-card"
                }`}
              >
                <input type="checkbox" name="interests" value={i.id} checked={on} onChange={() => toggle(i.id)} className="sr-only" />
                {i.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
        <input type="checkbox" name="showGoing" defaultChecked={initial.showGoing} className="mt-1 h-5 w-5 accent-ink" />
        <span>
          <span className="block font-medium">Show me to others going to the same event</span>
          <span className="text-sm text-muted">You can change this for any event, any time.</span>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-warn">
          {state.error}
        </p>
      )}
      {state.saved && <p className="text-sm text-host">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
