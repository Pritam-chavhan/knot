// All event times are shown and entered in India time, whatever the
// device's own time zone.
export const TZ = "Asia/Kolkata";

// "2026-11-21T18:30" typed into a datetime-local input, read as India time.
export function parseIstLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// The India calendar day of a moment, as "YYYY-MM-DD".
export function istDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// For datetime-local inputs: a moment as "YYYY-MM-DDTHH:mm" in India time.
export function toIstLocalInput(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function formatClock(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .format(d)
    .replace(/\s?([ap])\.?m\.?/i, (_, x: string) => ` ${x.toLowerCase()}m`);
}

// "Today", "Tomorrow", or "Sat 22 Nov".
export function dayLabel(d: Date, now = new Date()): string {
  const key = istDayKey(d);
  if (key === istDayKey(now)) return "Today";
  if (key === istDayKey(new Date(now.getTime() + 86_400_000))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d);
}

export function whenLabel(d: Date, now = new Date()): string {
  return `${dayLabel(d, now)}, ${formatClock(d)}`;
}
