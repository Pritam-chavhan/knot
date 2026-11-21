"use client";

import { useActionState, useRef, useState } from "react";
import { sendCode, type FormState } from "@/features/auth/actions";
import { Button } from "@/components/ui";

const DOMAIN = process.env.NEXT_PUBLIC_INSTITUTION_DOMAIN ?? "iitgn.ac.in";

export function SignInForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(sendCode, {});
  const [value, setValue] = useState(state.email?.split("@")[0] ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const typedFullEmail = value.includes("@");

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <label htmlFor="email" className="text-sm font-semibold text-ink">
        Your college email
      </label>
      {/* The whole box focuses the field, including the domain ending. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex h-14 cursor-text items-center rounded-[18px] border-[1.5px] bg-paper px-4 focus-within:border-thread focus-within:bg-card ${
          state.error ? "border-warn" : "border-line"
        }`}
      >
        <input
          ref={inputRef}
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
          aria-describedby={state.error ? "email-error" : "email-hint"}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted/80 focus:outline-none"
        />
        {!typedFullEmail && <span className="pointer-events-none text-base text-muted">@{DOMAIN}</span>}
      </div>
      {state.error ? (
        <p id="email-error" role="alert" className="text-sm font-medium text-warn">
          {state.error}
        </p>
      ) : (
        <p id="email-hint" className="text-[13px] text-muted">
          On a subdomain like caa.{DOMAIN}? Type your full email.
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-14">
        {pending ? "Sending your code…" : "Email me a sign-in code"}
      </Button>
      {pending && (
        <p role="status" className="text-center text-[13px] text-muted">
          This can take a few seconds. No need to tap again.
        </p>
      )}
    </form>
  );
}
