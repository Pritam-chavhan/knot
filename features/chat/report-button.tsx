"use client";

import { useState } from "react";
import { ReportForm } from "./report-form";
import { Sheet } from "./sheet";

// A quiet "Report this event" link at the foot of an event page.
export function ReportEventButton({ eventId, host }: { eventId: string; host?: { id: string; name: string } | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="mx-auto mt-6 flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-muted transition-colors hover:bg-card hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5" />
        </svg>
        Report this event
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Report this event">
        <ReportForm target={{ type: "event", id: eventId }} person={host ?? undefined} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
