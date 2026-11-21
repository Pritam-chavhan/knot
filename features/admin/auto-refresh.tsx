"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-reads the page every few seconds while it's on screen.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
