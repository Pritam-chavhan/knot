"use client";

import { isIOS, isInstalled, pushSupported, serviceWorker, urlBase64ToUint8Array } from "./device";
import { savePushSubscription } from "./actions";

export type PushState = "on" | "off" | "blocked" | "unsupported" | "install-first";

// The push address this phone last saved, so it's sent to the server once,
// not on every screen.
const SAVED_KEY = "knot:push-endpoint";
// Set when the student turns notifications off here, so nothing turns them
// back on behind their back.
const OFF_KEY = "knot:push-off";

function saved(): string | null {
  try {
    return localStorage.getItem(SAVED_KEY);
  } catch {
    return null;
  }
}

export function setOptedOut(off: boolean) {
  try {
    localStorage.removeItem(SAVED_KEY);
    if (off) localStorage.setItem(OFF_KEY, "1");
    else localStorage.removeItem(OFF_KEY);
  } catch {
    // Ignore.
  }
}

function optedOut(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

// What this phone can do right now, without asking anything.
export function pushState(): PushState {
  if (isIOS() && !isInstalled()) return "install-first";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" && !optedOut() ? "on" : "off";
}

// Asks the phone for permission. Must run straight from a tap: browsers only
// show the question in response to one.
export function askPermission(): Promise<NotificationPermission> | null {
  setOptedOut(false);
  if (pushState() !== "off" || Notification.permission === "granted") return null;
  try {
    return Notification.requestPermission();
  } catch {
    return null;
  }
}

// Once notifications are allowed, makes sure this phone is subscribed and the
// server knows it. Safe to call often: it only talks to the server when the
// phone's push address is new.
export async function ensurePush(publicKey: string): Promise<PushState> {
  const state = pushState();
  if (state !== "on") return state;
  const reg = await serviceWorker();
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  if (saved() !== sub.endpoint) {
    const { ok } = await savePushSubscription(sub.toJSON());
    if (!ok) throw new Error("save");
    try {
      localStorage.setItem(SAVED_KEY, sub.endpoint);
    } catch {
      // Private browsing: it will just be saved again next time.
    }
  }
  return "on";
}
