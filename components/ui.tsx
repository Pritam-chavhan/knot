import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function KnotMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M8 42C20 42 24 14 37 18C50 22 42 40 33 34C26 29 36 20 56 24" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <circle cx="56" cy="24" r="6" className="fill-marigold" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-ink ${className}`}>
      <KnotMark size={24} className="text-thread" />
      <span className="font-display text-[22px] font-extrabold leading-none">knot</span>
    </span>
  );
}

const buttonBase =
  "inline-flex h-13 min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition-[background-color,transform] active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

const buttonStyles = {
  primary: "bg-thread text-white hover:bg-thread-deep",
  dark: "bg-ink text-white hover:bg-black",
  ghost: "border border-line bg-card text-ink hover:border-ink/30",
  danger: "border border-warn/30 bg-card text-warn hover:bg-warn/5",
} as const;

type Variant = keyof typeof buttonStyles;

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${buttonBase} ${buttonStyles[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ href, variant = "primary", className = "", children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${buttonBase} ${buttonStyles[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "h-13 min-h-12 w-full rounded-[18px] border-[1.5px] border-line bg-card px-4 text-base text-ink placeholder:text-muted/80 focus:border-thread focus:outline-none";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[28px] bg-card p-5 ${className}`}>{children}</div>;
}

const AVATAR_COLORS = ["bg-thread text-white", "bg-marigold text-ink", "bg-river-deep text-white", "bg-rose text-ink", "bg-ink text-white"];

export function Avatar({ name, size = 40, index, className = "" }: { name: string; size?: number; index?: number; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, size < 44 ? 1 : 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const i = index ?? [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ring-[3px] ring-card ${AVATAR_COLORS[i % AVATAR_COLORS.length]} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </span>
  );
}

export function Toggle({ name, defaultChecked, title, description }: { name: string; defaultChecked?: boolean; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 py-1">
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="text-[13px] leading-snug text-muted">{description}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-thread peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-thread after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}
