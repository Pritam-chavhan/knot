import Link from "next/link";
import { Avatar } from "@/components/ui";
import type { PersonCardData } from "./directory-queries";

// The doorway to People on Discover: a few faces and how many are here.
export function PeopleTeaser({ people, count }: { people: PersonCardData[]; count: number }) {
  if (count === 0) return null;
  const faces = people.slice(0, 3);
  return (
    <Link
      href="/people"
      className="mt-3 flex min-h-[76px] items-center gap-3.5 rounded-[24px] bg-card px-4 py-3.5 transition-transform active:scale-[0.99]"
    >
      <span className="flex shrink-0 -space-x-3" aria-hidden="true">
        {faces.map((p, i) => (
          <Avatar key={p.id} name={p.name} size={38} src={p.avatar} index={i} className="ring-[3px] ring-card" />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">Meet people at IITGN</span>
        <span className="block text-[13px] text-soft">
          {count === 1 ? "1 student" : `${count} students`} on KNOT. Find yours.
        </span>
      </span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
