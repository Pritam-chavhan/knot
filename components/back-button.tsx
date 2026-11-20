"use client";

import { useRouter } from "next/navigation";

// Goes back if there's somewhere in KNOT to go back to, otherwise to a sensible page.
export function BackButton({ fallback = "/discover", className = "" }: { fallback?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        const fromHere = document.referrer && new URL(document.referrer).origin === location.origin;
        if (fromHere && history.length > 1) router.back();
        else router.push(fallback);
      }}
      className={`flex h-11 w-11 items-center justify-center rounded-full bg-card transition-transform active:scale-90 ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}
