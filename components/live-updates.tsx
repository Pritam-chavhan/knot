"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

type Row = { id?: string; status?: string; review_status?: string };
const isLive = (r: Row) => (r.status === "published" || r.status === "full") && r.review_status === "approved";

// Shows a "New events" pill when events appear while this screen is open
// (added, or approved by an admin), applies other changes quietly, and
// refreshes when you come back to the tab. Refreshes are spread out and
// capped so a burst of edits can't hammer everyone's screens.
export function LiveUpdates({ knownIds }: { knownIds: string[] }) {
  const router = useRouter();
  const [added, setAdded] = useState<string[]>([]);
  const [changed, setChanged] = useState(false);
  const [pending, start] = useTransition();
  const known = useRef(new Set(knownIds));
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    known.current = new Set(knownIds);
  }, [knownIds]);

  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("events-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, (payload: { new?: unknown }) => {
        const row = (payload.new ?? {}) as Row;
        if (!row.id) return;
        if (!known.current.has(row.id) && isLive(row)) {
          setAdded((ids) => (ids.includes(row.id!) ? ids : [...ids, row.id!]));
        } else if (known.current.has(row.id)) {
          setChanged(true);
        }
      })
      .subscribe();

    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Changes to events already on screen (time, venue, cancelled) apply
  // without asking: at most every 30 seconds, with a random delay so open
  // screens don't all refresh at the same moment.
  useEffect(() => {
    if (!changed) return;
    const wait = Math.max(0, 30_000 - (Date.now() - lastRefresh.current)) + 1500 + Math.random() * 4000;
    const t = setTimeout(() => {
      setChanged(false);
      lastRefresh.current = Date.now();
      router.refresh();
    }, wait);
    return () => clearTimeout(t);
  }, [changed, router]);

  const count = added.length;
  const show = count > 0;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center px-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {show && (
        <button
          type="button"
          onClick={() =>
            start(() => {
              router.refresh();
              lastRefresh.current = Date.now();
              setAdded([]);
              window.scrollTo({ top: 0, behavior: "smooth" });
            })
          }
          className="animate-drop-in pointer-events-auto flex min-h-11 items-center gap-2 rounded-full bg-thread px-5 text-[14px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(90,61,240,0.8)] transition-transform active:scale-95 motion-reduce:animate-none"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          {pending ? "Loading…" : count === 1 ? "1 new event" : `${count} new events`}
        </button>
      )}
    </div>
  );
}
