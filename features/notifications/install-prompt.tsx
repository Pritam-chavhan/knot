"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAndroid, isIOS, isInstalled } from "./device";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "knot:install-dismissed";
const QUIET_DAYS = 7;

// Chrome may offer installing before this card appears, so catch the offer
// as soon as this code loads.
let offer: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    offer = e as InstallEvent;
    listeners.forEach((l) => l());
  });
}

// "Get KNOT on your home screen", shown on phones that haven't added it yet.
// Android gets a one-tap Install; iPhone gets the steps. "Not now" hides it
// for a week.
export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"android" | "iphone" | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (isInstalled()) return;
    const p = isIOS() ? "iphone" : isAndroid() ? "android" : null;
    if (!p) return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() - at < QUIET_DAYS * 86_400_000) return;
    } catch {
      // Private browsing: show it.
    }
    setPlatform(p);
    setShow(true);
    const update = () => setCanInstall(!!offer);
    update();
    listeners.add(update);
    const installed = () => setShow(false);
    window.addEventListener("appinstalled", installed);
    return () => {
      listeners.delete(update);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore.
    }
    setShow(false);
  }

  async function install() {
    if (!offer) return;
    await offer.prompt();
    const { outcome } = await offer.userChoice;
    offer = null;
    if (outcome === "accepted") setShow(false);
    else setCanInstall(false);
  }

  if (!show || !platform) return null;

  return (
    <section aria-label="Add KNOT to your home screen" className="relative mt-5 flex items-center gap-3.5 rounded-[26px] bg-thread-tint py-3.5 pr-3 pl-4">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-thread text-white">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M12 8v6M9 11h6" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-thread-deep">Get KNOT on your home screen</span>
        <span className="block text-[13px] leading-snug text-soft">Opens like an app in one tap, with notifications.</span>
      </span>
      {platform === "android" && canInstall ? (
        <button type="button" onClick={install} className="min-h-11 shrink-0 rounded-full bg-thread px-4 text-[14px] font-bold text-white transition-transform active:scale-95">
          Install
        </button>
      ) : (
        <Link href="/install" className="flex min-h-11 shrink-0 items-center rounded-full bg-thread px-4 text-[14px] font-bold text-white transition-transform active:scale-95">
          Show me
        </Link>
      )}
      <button type="button" onClick={dismiss} aria-label="Not now" className="absolute -top-4 -right-3 flex h-11 w-11 items-center justify-center rounded-full">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-muted shadow-[0_2px_8px_rgba(23,20,43,0.15)]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </span>
      </button>
    </section>
  );
}
