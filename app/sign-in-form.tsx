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
      <Field
        label="Your college email"
        htmlFor="email"
        error={state.error}
        hint={`On a subdomain like caa.${DOMAIN}? Type your full email.`}
      >
        <div className="flex h-14 items-center rounded-[18px] border-[1.5px] border-line bg-paper px-4 focus-within:border-thread focus-within:bg-card">
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
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted/80 focus:outline-none"
          />
          {!typedFullEmail && <span className="text-base text-muted">@{DOMAIN}</span>}
        </div>
      </Field>
      <Button type="submit" disabled={pending} className="h-14">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
