import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// The KNOT mark: a trefoil, the simplest true knot. One unbroken thread with
// three loops, drawn with real gaps where it passes under itself, so it works
// on any background in any single colour.
export function KnotMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={10}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M41.3 44.2 L40.3 45.7 L39.4 47.3 L38.6 48.9 L37.8 50.5 L37.2 52.2 L36.6 53.8 L36.1 55.5 L35.6 57.2 L35.3 59.0 L35.0 60.7 L34.8 62.3 L34.7 64.0 L34.7 65.7 L34.8 67.3 L34.9 68.9 L35.1 70.4 L35.4 72.0 L35.8 73.4 L36.2 74.8 L36.7 76.2 L37.3 77.4 L38.0 78.6 L38.7 79.8 L39.5 80.8 L40.3 81.8 L41.1 82.7 L42.0 83.5 L43.0 84.2 L44.0 84.8 L45.0 85.3 L46.0 85.8 L47.1 86.1 L48.2 86.3 L49.2 86.4 L50.3 86.4 L51.4 86.4 L52.5 86.2 L53.5 85.9 L54.6 85.5 L55.6 85.0 L56.6 84.4 L57.6 83.8 L58.5 83.0 L59.4 82.1 L60.2 81.2 L61.0 80.1 L61.7 79.0 L62.4 77.9 L63.0 76.6 L63.5 75.3 L64.0 73.9 L64.4 72.4" />
      <path d="M61.1 48.3 L60.2 46.7 L59.3 45.2 L58.3 43.7 L57.3 42.2 L56.2 40.8 L55.0 39.4 L53.8 38.1 L52.5 36.9 L51.2 35.7 L49.9 34.7 L48.5 33.7 L47.1 32.7 L45.7 31.9 L44.3 31.1 L42.8 30.4 L41.4 29.9 L39.9 29.4 L38.5 29.0 L37.0 28.6 L35.6 28.4 L34.2 28.3 L32.8 28.2 L31.5 28.3 L30.2 28.4 L28.9 28.6 L27.7 28.9 L26.6 29.3 L25.5 29.8 L24.5 30.3 L23.5 31.0 L22.6 31.6 L21.8 32.4 L21.1 33.2 L20.5 34.1 L19.9 35.0 L19.4 36.0 L19.1 37.0 L18.8 38.1 L18.6 39.2 L18.5 40.3 L18.5 41.5 L18.6 42.6 L18.8 43.8 L19.1 45.0 L19.5 46.2 L20.0 47.4 L20.6 48.6 L21.3 49.8 L22.1 50.9 L23.0 52.0 L23.9 53.1 L25.0 54.2" />
      <path d="M47.5 63.4 L49.4 63.5 L51.2 63.4 L53.0 63.3 L54.8 63.2 L56.5 62.9 L58.3 62.6 L60.0 62.2 L61.7 61.7 L63.4 61.2 L65.0 60.6 L66.5 59.9 L68.0 59.1 L69.5 58.3 L70.8 57.4 L72.2 56.5 L73.4 55.6 L74.5 54.5 L75.6 53.5 L76.6 52.4 L77.5 51.3 L78.3 50.1 L79.1 49.0 L79.7 47.8 L80.2 46.6 L80.7 45.4 L81.0 44.2 L81.2 43.0 L81.4 41.9 L81.4 40.7 L81.4 39.6 L81.2 38.5 L81.0 37.4 L80.6 36.3 L80.2 35.3 L79.6 34.4 L79.0 33.5 L78.3 32.7 L77.6 31.9 L76.7 31.2 L75.8 30.5 L74.8 30.0 L73.7 29.5 L72.6 29.1 L71.4 28.7 L70.1 28.5 L68.9 28.3 L67.5 28.2 L66.2 28.3 L64.8 28.4 L63.4 28.6 L61.9 28.8 L60.5 29.2" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-ink ${className}`}>
      <KnotMark size={26} className="text-thread" />
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

export function Avatar({
  name,
  size = 40,
  index,
  src,
  className = "",
}: {
  name: string;
  size?: number;
  index?: number;
  src?: string | null;
  className?: string;
}) {
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
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own auth-checked route
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className="h-full w-full rounded-full object-cover" />
      ) : (
        initials || "?"
      )}
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
