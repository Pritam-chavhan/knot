"use client";

import { useActionState, useEffect, useState } from "react";
import { resendCode, verifyCode, type FormState } from "@/features/auth/actions";
import { Button, Field, inputClass } from "@/components/ui";

const WAIT = 60;

export function VerifyForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(verifyCode, { email });
  return (
    <>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <Field label="Sign-in code" htmlFor="code" error={state.error}>
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
            className={`${inputClass} font-display text-center text-3xl font-bold tracking-[0.35em]`}
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Checking…" : "Verify and continue"}
        </Button>
      </form>
      <Resend email={email} />
    </>
  );
}

// A new code can be asked for once a minute. Each new code replaces the last.
function Resend({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resendCode, { email });
  const [left, setLeft] = useState(WAIT);

  useEffect(() => {
    if (state.sent) setLeft(WAIT);
  }, [state.sent]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <form action={action} className="mt-4 text-center">
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={pending || left > 0}
        className="min-h-11 rounded-full px-4 text-[14px] font-bold text-thread underline-offset-2 hover:underline disabled:text-muted disabled:no-underline"
      >
        {pending ? "Sending a new code…" : left > 0 ? `Send a new code in ${left}s` : "Send a new code"}
      </button>
      <p role="status" className="text-[13px] text-muted">
        {state.error ?? (state.sent ? "New code sent. Use only the newest one." : "Codes can take a minute to arrive.")}
      </p>
    </form>
  );
}
