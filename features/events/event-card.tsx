import Link from "next/link";
import { TagPill } from "@/components/art";
import { Avatar } from "@/components/ui";
import { formatClock } from "@/lib/time";
import { SOURCE_TAG } from "./categories";
import type { FeedEvent } from "./queries";

function MyState({ e }: { e: FeedEvent }) {
  if (e.status === "cancelled") return <span className="rounded-full bg-warn px-2.5 py-1 text-[12px] font-bold text-white">Cancelled</span>;
  if (e.my_state === "going")
    return <span className="rounded-full bg-marigold px-2.5 py-1 text-[12px] font-bold text-ink">You&apos;re going</span>;
  if (e.my_state === "interested")
    return <span className="rounded-full bg-thread-tint px-2.5 py-1 text-[12px] font-bold text-thread-deep">Interested</span>;
  if (e.status === "full") return <span className="rounded-full bg-paper px-2.5 py-1 text-[12px] font-bold text-soft">Full</span>;
  return null;
}

export function EventCard({ e }: { e: FeedEvent }) {
  const start = new Date(e.starts_at);
  const cancelled = e.status === "cancelled";
  const where = [e.venue, e.source_type === "student_hosted" && e.host_name ? `hosted by ${e.host_name.split(" ")[0]}` : e.organiser]
    .filter(Boolean)
    .join(" · ");
  const spots = e.capacity && e.source_type === "student_hosted" ? Math.max(0, e.capacity - e.going) : null;

  return (
    <Link
      href={`/events/${e.id}`}
      className={`block rounded-[24px] p-4 transition-transform active:scale-[0.99] ${cancelled ? "border-[1.5px] border-dashed border-line bg-paper" : "bg-card"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[15px] font-bold">{formatClock(start)}</span>
        <TagPill tag={SOURCE_TAG[e.source_type]} />
      </div>
      <h3 className={`font-display mt-1.5 text-[19px] leading-tight font-bold ${cancelled ? "line-through" : ""}`}>{e.title}</h3>
      {where && <p className="mt-1 truncate text-[14px] text-muted">{where}</p>}
      <div className="mt-3 flex items-center gap-2.5">
        {e.going_names.length > 0 && (
          <span className="flex -space-x-2">
            {e.going_names.map((n, i) => (
              <Avatar key={`${n}-${i}`} name={n} size={26} index={i + 1} className="ring-2" />
            ))}
          </span>
        )}
        <span className="text-[13px] font-semibold text-soft">
          <span className="font-display text-[16px] font-extrabold text-ink">{e.going}</span> going
          {e.interested > 0 && <> · {e.interested} interested</>}
          {spots !== null && !cancelled && e.status !== "full" && (
            <span className="text-river-deep"> · {spots === 1 ? "1 spot left" : `${spots} spots left`}</span>
          )}
        </span>
        <span className="ml-auto">
          <MyState e={e} />
        </span>
      </div>
    </Link>
  );
}
