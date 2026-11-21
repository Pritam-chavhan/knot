export type Bounds = {
  south: number;
  north: number;
  west: number;
  east: number;
  center_lat: number;
  center_lng: number;
  // The campus outline as [lat, lng] points, when set.
  polygon?: [number, number][];
  // Sharing works anywhere within this distance of the centre.
  radius_m?: number;
};

export type Sharing = { expires_at: string; visibility: "connections" | "campus"; precise: boolean; started_at: string };

export type MapPerson = {
  id: string;
  name: string;
  programme: string | null;
  avatar: string | null;
  lat: number;
  lng: number;
  precise: boolean;
  updatedAt: string;
  connected: boolean;
};

export type Wave = { id: string; fromId: string; name: string; avatar: string | null; at: string; visible: boolean };

export const DURATIONS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
] as const;

const MESSAGES: Record<string, string> = {
  off_campus: "You're not on campus right now. The map works within 1.5 km of IITGN.",
  bad_duration: "Pick how long to share.",
  bad_visibility: "Pick who can see you.",
  not_found: "They've stopped sharing.",
  already_waved: "You waved recently. Give them a moment.",
};

// Phones can share an approximate location, blurred by a kilometre or more.
export const APPROXIMATE_M = 500;

export function preciseLocationHelp(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "On iPhone: Settings → Privacy & Security → Location Services → Safari Websites, then turn on Precise Location.";
  if (/Android/i.test(ua)) return "On Android: long-press Chrome → App info → Permissions → Location, then turn on Use precise location.";
  return "Turn on precise location for your browser in your phone's settings.";
}

export function approximateNote(accuracy: number): string {
  const km = accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${Math.round(accuracy)} m`;
  return `Your phone is sharing an approximate location (within about ${km}), so your pin may be off. ${preciseLocationHelp()}`;
}

export function mapError(error: { message?: string } | null | undefined, accuracy?: number): string {
  const msg = error?.message ?? "";
  if (msg.startsWith("rate_limited")) return "You're doing that a lot. Try again later.";
  const off = msg.match(/off_campus:(\d+)/);
  if (off && accuracy && accuracy > APPROXIMATE_M) {
    return `Your phone is only sharing an approximate location, so KNOT can't tell you're on campus. ${preciseLocationHelp()} Then try again.`;
  }
  if (off) {
    const m = Number(off[1]);
    const acc = accuracy && Number.isFinite(accuracy) ? ` Your phone's location is accurate to about ${Math.round(accuracy)} m.` : "";
    return `Your location shows about ${m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`} beyond the campus area.${acc} If you're on campus, step outside or near a window, wait a few seconds, then try again.`;
  }
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k));
  return key ? MESSAGES[key] : "That didn't work. Check your connection and try again.";
}

export function geoError(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return "Location is turned off for KNOT. Allow it in your browser's site settings, then try again.";
  if (err.code === err.TIMEOUT) return "Finding you took too long. Step outside or check that location is on, then try again.";
  return "Couldn't find your location. Check that location is on, then try again.";
}

// Distance in metres between two points (good enough on a campus).
export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6_371_000;
  const toRad = Math.PI / 180;
  const x = (b.lng - a.lng) * toRad * Math.cos(((a.lat + b.lat) / 2) * toRad);
  const y = (b.lat - a.lat) * toRad;
  return Math.sqrt(x * x + y * y) * r;
}

export function minutesLeft(expiresAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60_000));
}

export function ago(iso: string, now = Date.now()) {
  const m = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} min ago`;
  return "over an hour ago";
}
