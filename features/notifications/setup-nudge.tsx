"use client";

import { useEffect, useState } from "react";
import { InstallPrompt } from "./install-prompt";
import { NotificationsCard } from "./notifications-card";
import { pushState } from "./push-client";

// One small card at most on Discover: turn on notifications if this phone
// can, otherwise the home-screen tip (which iPhones need before they can get
// notifications at all).
export function SetupNudge({ publicKey }: { publicKey: string | null }) {
  const [show, setShow] = useState<"notify" | "install" | null>(null);
  useEffect(() => {
    setShow(publicKey && pushState() === "off" ? "notify" : "install");
  }, [publicKey]);
  if (show === "notify" && publicKey) return <NotificationsCard publicKey={publicKey} compact />;
  if (show === "install") return <InstallPrompt />;
  return null;
}
