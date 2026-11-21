// KNOT service worker. It only shows notifications and opens the right
// screen when one is tapped; it doesn't cache pages or data.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const safePath = (url) => (typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/discover");

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title.slice(0, 80) : "KNOT";
  const body = typeof data.body === "string" ? data.body.slice(0, 160) : "";
  const url = safePath(data.url);
  const tag = typeof data.tag === "string" ? data.tag.slice(0, 80) : undefined;

  event.waitUntil(
    (async () => {
      // No buzz for a screen the student is already looking at.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const onIt = windows.some((w) => w.focused && w.visibilityState === "visible" && new URL(w.url).pathname === url);
      if (onIt) return;
      await self.registration.showNotification(title, {
        body,
        tag,
        renotify: !!tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if ("focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
