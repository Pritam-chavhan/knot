"use client";

import { useActionState, useState } from "react";
import { sendCode, type FormState } from "@/features/auth/actions";
import { Button, Field } from "@/components/ui";

const DOMAIN = process.env.NEXT_PUBLIC_INSTITUTION_DOMAIN ?? "iitgn.ac.in";

export function SignInForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(sendCode, {});
  const [value, setValue] = useState("");
  const typedFullEmail = value.includes("@");
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <Field label="Your college email" htmlFor="email" error={state.error}>
        <div className="flex h-14 items-center rounded-2xl border border-line bg-card px-4 focus-within:border-ink">
          <input
            id="email"
            name="email"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="yourname"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            aria-invalid={!!state.error}
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          />
          {!typedFullEmail && <span className="text-base text-muted">@{DOMAIN}</span>}
        </div>
      </Field>
      <p className="-mt-1 text-xs text-muted">Using a subdomain like @caa.{DOMAIN}? Type your full email.</p>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending code…" : "Send my code"}
      </Button>
    </form>
  );
}
