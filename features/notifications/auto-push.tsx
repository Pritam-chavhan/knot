"use client";

import { useEffect } from "react";
import { ensurePush } from "./push-client";

// Runs on every signed-in screen. Once this phone has allowed notifications
// (for example from the welcome tour), it subscribes it and tells the server,
// once. It never asks for permission itself and never shows anything.
export function AutoPush({ publicKey }: { publicKey: string }) {
  useEffect(() => {
    const run = () => void ensurePush(publicKey).catch(() => {});
    run();
    // The permission answer can arrive after this screen opened.
    let status: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((s) => {
        status = s;
        s.onchange = run;
      })
      .catch(() => {});
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (status) status.onchange = null;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [publicKey]);
  return null;
}
