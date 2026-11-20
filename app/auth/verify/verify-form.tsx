"use client";

import { useActionState } from "react";
import { verifyCode, type FormState } from "@/features/auth/actions";
import { Button, Field, inputClass } from "@/components/ui";

export function VerifyForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(verifyCode, { email });
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="email" value={email} />
      <Field label="Code" htmlFor="code" error={state.error}>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          required
          autoFocus
          aria-invalid={!!state.error}
          className={`${inputClass} text-center font-serif text-3xl tracking-[0.4em]`}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Verify and continue"}
      </Button>
    </form>
  );
}
