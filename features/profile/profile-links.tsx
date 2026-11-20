import { LINKS, LINK_KINDS, linkUrl, type LinkKind } from "./links";

type WithLinks = Partial<Record<LinkKind, string | null>>;

// Opens on the official site only; usernames are validated before saving.
export function ProfileLinks({ profile, tone = "light" }: { profile: WithLinks; tone?: "light" | "dark" }) {
  const kinds = LINK_KINDS.filter((k) => profile[k]);
  if (kinds.length === 0) return null;
  const chip =
    tone === "dark"
      ? "bg-white/12 text-white hover:bg-white/20"
      : "bg-card text-ink hover:bg-thread-tint shadow-[0_1px_0_rgba(23,20,43,0.06)]";
  return (
    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Links">
      {kinds.map((k) => (
        <li key={k}>
          <a
            href={linkUrl(k, profile[k]!)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors active:scale-[0.97] ${chip}`}
          >
            <span className="font-bold">{LINKS[k].label}</span>
            <span className={tone === "dark" ? "text-white/70" : "text-muted"}>@{profile[k]}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
            <span className="sr-only">(opens {LINKS[k].label})</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
