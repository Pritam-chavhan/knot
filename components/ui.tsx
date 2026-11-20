import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif text-2xl tracking-tight ${className}`}>
      knot<span className="text-accent">.</span>
    </span>
  );
}

const buttonBase =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors disabled:opacity-50";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-ink text-paper hover:bg-black",
    ghost: "border border-line bg-transparent text-ink hover:bg-card",
    danger: "border border-warn/40 bg-transparent text-warn hover:bg-warn/5",
  }[variant];
  return <button className={`${buttonBase} ${styles} ${className}`} {...props} />;
}

export function ButtonLink({ href, variant = "primary", className = "", children }: { href: string; variant?: "primary" | "ghost"; className?: string; children: ReactNode }) {
  const styles = variant === "primary" ? "bg-ink text-paper hover:bg-black" : "border border-line text-ink hover:bg-card";
  return (
    <Link href={href} className={`${buttonBase} ${styles} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-soft">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "h-14 w-full rounded-2xl border border-line bg-card px-4 text-base text-ink placeholder:text-muted focus:border-ink focus:outline-none";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-3xl border border-line bg-card p-5 ${className}`}>{children}</div>;
}
