"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAndroid, isIOS, isInstalled } from "@/features/notifications/device";

type Platform = "android" | "iphone";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const SITE = "knot-tau.vercel.app";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-thread text-[15px] font-extrabold text-white">
        {n}
      </span>
      <span className="pt-1 text-[16px] leading-snug">{children}</span>
    </li>
  );
}

// Inline pictures of the buttons students need to find.
const ShareIcon = () => (
  <svg aria-label="Share" role="img" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-1 inline -translate-y-0.5 text-[#0A84FF]">
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H17" />
  </svg>
);
const MenuIcon = () => (
  <svg aria-label="Menu" role="img" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="mx-1 inline -translate-y-0.5">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("android");
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isIOS()) setPlatform("iphone");
    else if (isAndroid()) setPlatform("android");
    setInstalled(isInstalled());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  async function share() {
    const url = `https://${SITE}/install`;
    try {
      if (navigator.share) await navigator.share({ title: "Add KNOT to your phone", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Closed the share sheet.
    }
  }

  const tab = (p: Platform, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={platform === p}
      onClick={() => setPlatform(p)}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-full text-[15px] font-bold ${platform === p ? "bg-ink text-white" : "text-soft"}`}
    >
      {label}
    </button>
  );

  if (installed) {
    return (
      <div className="mt-6 rounded-[28px] bg-card p-6 text-center">
        <p className="font-display text-[24px] font-extrabold">KNOT is on your phone</p>
        <p className="mt-2 text-soft">Open it from your home screen any time. Turn on notifications in the You tab.</p>
        <Link href="/discover" className="mt-5 inline-flex min-h-[52px] items-center rounded-full bg-thread px-6 font-bold text-white">
          Open KNOT
        </Link>
      </div>
    );
  }

  return (
    <>
      <div role="tablist" aria-label="Your phone" className="mt-6 flex gap-1 rounded-full bg-card p-1">
        {tab("android", "Android")}
        {tab("iphone", "iPhone")}
      </div>

      {platform === "android" ? (
        <section className="mt-4 rounded-[28px] bg-card p-5" aria-label="Android steps">
          {prompt && (
            <>
              <button type="button" onClick={install} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-thread text-[17px] font-extrabold text-white transition-transform active:scale-[0.98]">
                Install KNOT
              </button>
              <p className="mt-3 mb-4 text-center text-[13px] text-muted">One tap. Or follow the steps below.</p>
            </>
          )}
          <ol className="flex flex-col gap-4">
            <Step n={1}>
              Open <b>{SITE}</b> in <b>Chrome</b>.
            </Step>
            <Step n={2}>
              Tap the menu <MenuIcon /> at the top right.
            </Step>
            <Step n={3}>
              Tap <b>Add to Home screen</b> (it may say <b>Install app</b>).
            </Step>
            <Step n={4}>
              Tap <b>Install</b>. KNOT appears on your home screen and in your app list.
            </Step>
          </ol>
          <p className="mt-4 rounded-[18px] bg-paper px-4 py-3 text-[14px] text-soft">
            On Samsung Internet: tap the menu ☰, then <b>Add page to</b>, then <b>Home screen</b>.
          </p>
        </section>
      ) : (
        <section className="mt-4 rounded-[28px] bg-card p-5" aria-label="iPhone steps">
          <ol className="flex flex-col gap-4">
            <Step n={1}>
              Open <b>{SITE}</b> in <b>Safari</b>.
            </Step>
            <Step n={2}>
              Tap the Share button <ShareIcon /> at the bottom of the screen.
            </Step>
            <Step n={3}>
              Scroll down and tap <b>Add to Home Screen</b>.
            </Step>
            <Step n={4}>
              Tap <b>Add</b> at the top right.
            </Step>
            <Step n={5}>
              Open KNOT from your Home Screen and sign in once more (the Home Screen app keeps its own sign-in).
            </Step>
          </ol>
          <p className="mt-4 rounded-[18px] bg-paper px-4 py-3 text-[14px] text-soft">
            Chrome on iPhone works too: tap <ShareIcon /> in the address bar, then <b>Add to Home Screen</b>. Notifications need iOS 16.4 or newer.
          </p>
        </section>
      )}

      <section className="mt-4 rounded-[28px] bg-card p-5" aria-label="After installing">
        <h2 className="font-display text-[20px] font-extrabold">Then turn on notifications</h2>
        <p className="mt-1 text-[15px] text-soft">
          Open KNOT from your home screen, go to <b>You</b> and tap <b>Turn on</b> under notifications. You&apos;ll hear about messages, connection requests, people joining your plans and waves.
        </p>
      </section>

      <button type="button" onClick={share} className="mx-auto mt-5 flex min-h-11 items-center rounded-full px-4 text-[14px] font-bold text-thread-deep hover:bg-card">
        {copied ? "Link copied" : "Share this guide with friends"}
      </button>
    </>
  );
}
