const TZ = "Asia/Kolkata";
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 60) return m <= 1 ? "Just now" : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}
export const dateShort = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
