"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isIOS, isInstalled, pushSupported, serviceWorker, urlBase64ToUint8Array } from "./device";
import { removePushSubscription, savePushSubscription } from "./actions";

type State = "loading" | "unsupported" | "install-first" | "off" | "on" | "blocked" | "busy";

// Turns notifications on or off for this phone. `compact` is the nudge shown
// at the top of Chats: it only appears while notifications are off.
export function NotificationsCard({ publicKey, compact = false }: { publicKey: string; compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (isIOS() && !isInstalled()) return setState("install-first");
      if (!pushSupported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await serviceWorker();
      const sub = await reg?.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") {
        // Keep the server's copy current (it may have been cleared).
        void savePushSubscription(sub.toJSON());
        return setState("on");
      }
      setState("off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setError(null);
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const reg = await serviceWorker();
      if (!reg) return setState("unsupported");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const { ok } = await savePushSubscription(sub.toJSON());
      if (!ok) throw new Error("save");
      setState("on");
    } catch {
      setError("Notifications couldn't be turned on. Try again in a moment.");
      setState("off");
    }
  }

  async function turnOff() {
    setState("busy");
    const reg = await serviceWorker();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe().catch(() => {});
    }
    setState("off");
  }

  if (compact && !["off", "install-first"].includes(state)) return null;
  if (state === "loading" || (compact && state === "busy")) return null;

  const icon = (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marigold text-ink">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
        <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
      </svg>
    </span>
  );

  const text: Record<Exclude<State, "loading" | "busy">, { title: string; body: string }> = {
    off: { title: "Turn on notifications", body: "Know when someone messages you, wants to connect, joins your plan or waves." },
    on: { title: "Notifications are on", body: "For this phone. They show who it's from, never what they wrote." },
    "install-first": { title: "Get notifications on iPhone", body: "Add KNOT to your Home Screen first, then turn them on here." },
    blocked: { title: "Notifications are blocked", body: "Allow them for KNOT in your phone's or browser's settings, then reopen KNOT." },
    unsupported: { title: "Notifications aren't available here", body: "Open KNOT in Chrome on Android, or add it to your Home Screen on iPhone." },
  };
  const t = text[state === "busy" ? "off" : state];

  return (
    <section aria-label="Notifications" className={`flex items-center gap-3.5 rounded-[24px] px-4 py-3.5 ${compact ? "mt-5 bg-marigold-tint" : "mt-4 bg-card"}`}>
      {icon}
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t.title}</p>
        <p className="text-[13px] text-soft">{t.body}</p>
        {error && (
          <p role="alert" className="mt-1 text-[13px] font-medium text-warn">
            {error}
          </p>
        )}
      </div>
      {(state === "off" || state === "busy") && (
        <button type="button" onClick={turnOn} disabled={state === "busy"} className="min-h-11 shrink-0 rounded-full bg-ink px-4 text-[14px] font-bold text-white transition-transform active:scale-95 disabled:opacity-60">
          {state === "busy" ? "Turning on…" : "Turn on"}
        </button>
      )}
      {state === "on" && !compact && (
        <button type="button" onClick={turnOff} className="min-h-11 shrink-0 rounded-full border-[1.5px] border-line px-4 text-[14px] font-bold">
          Turn off
        </button>
      )}
      {state === "install-first" && (
        <Link href="/install" className="flex min-h-11 shrink-0 items-center rounded-full bg-ink px-4 text-[14px] font-bold text-white">
          Show me
        </Link>
      )}
    </section>
  );
}
