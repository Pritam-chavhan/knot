import { istDayKey, parseIstLocal } from "@/lib/time";
import type { Candidate, ExtractedItem } from "./extract";

// Every event from mail is a Campus event. It goes live on its own only when all of these hold: the sender is a
// verified IITGN address, the AI is at least this sure, the time is stated,
// and any link points to a familiar site. Everything else waits for review.
export const AUTO_PUBLISH = 0.8;
const HOUR = 3600_000;
const MAX_AHEAD = 365 * 24 * HOUR;

// Sites campus events commonly link to. Other links are kept but the event
// waits for a quick look.
const FAMILIAR_HOSTS = [
  "iitgn.ac.in",
  "forms.gle",
  "docs.google.com",
  "forms.office.com",
  "meet.google.com",
  "zoom.us",
  "teams.microsoft.com",
  "youtube.com",
  "youtu.be",
  "unstop.com",
  "devfolio.co",
  "lu.ma",
  "eventbrite.com",
  "eventbrite.co.in",
  "github.com",
  "linkedin.com",
  "instagram.com",
];

// Who sent the mail, as far as the server can tell.
export type Sender = {
  // Gmail confirmed the From address (DMARC) and it's on the institution domain.
  trusted: boolean;
  // Lowercased address, or null if it couldn't be read.
  address: string | null;
};

export type EventFields = {
  title: string;
  category: string;
  source_type: "official" | "community";
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  organiser: string | null;
  description: string | null;
  registration_url: string | null;
};

type Change = { starts_at?: string; ends_at?: string | null; venue?: string };

export type Decision =
  | { action: "skip"; outcome: "past" | "not_event"; note?: string }
  | { action: "create"; fields: EventFields; dedupeKey: string; publish: boolean; confidence: number; note?: string }
  | { action: "update"; eventId: string; before: Change; after: Change; apply: boolean; confidence: number; note?: string }
  | { action: "cancel"; eventId: string; apply: boolean; confidence: number; note?: string }
  | { action: "reminder"; eventId: string };

const clip = (v: string | null | undefined, max: number) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

export function cleanTitle(v: string | null | undefined) {
  let t = (v ?? "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4; i++) t = t.replace(/^(re|fw|fwd|reminder|invitation|invite|announcement|update|important)\s*[:|-]\s*/i, "");
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
  return t.length >= 3 ? t.slice(0, 120) : null;
}

// Phone numbers and email addresses don't belong in a public description.
export function scrubContacts(v: string | null) {
  if (!v) return v;
  const out = v
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "")
    .replace(/(?:\+?91[\s-]?)?(?<!\d)[6-9]\d{4}[\s-]?\d{5}(?!\d)/g, "")
    .replace(/\(\s*\)|\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
  return out || null;
}

export function safeUrl(v: string | null | undefined) {
  const t = (v ?? "").trim();
  if (!t || t.length > 500 || !/^https:\/\/[^\s<>"']+$/.test(t)) return null;
  try {
    const u = new URL(t);
    // "https://iitgn.ac.in@evil.example" hides the real site behind a name.
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function familiarHost(url: string | null) {
  if (!url) return true;
  const host = new URL(url).hostname.toLowerCase();
  return FAMILIAR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export function dedupeKey(title: string, start: Date) {
  const words = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  return `mail:${istDayKey(start)}:${words}`.slice(0, 200);
}

function times(item: ExtractedItem, now: Date) {
  const start = item.event?.starts_at ? parseIstLocal(item.event.starts_at) : null;
  let end = item.event?.ends_at ? parseIstLocal(item.event.ends_at) : null;
  if (start && end && (end <= start || end.getTime() - start.getTime() > 3 * 24 * HOUR)) end = null;
  const over = !!start && (end ? end.getTime() < now.getTime() : start.getTime() < now.getTime() - 30 * 60_000);
  const tooFar = !!start && start.getTime() - now.getTime() > MAX_AHEAD;
  return { start, end, over, tooFar };
}

export function decideItem(item: ExtractedItem, known: Candidate[], now: Date, sender: Sender): Decision {
  const note = clip(item.note, 200) ?? undefined;
  const ref = item.ref?.trim().toUpperCase();
  const match = ref ? known.find((k) => k.ref === ref) : undefined;
  const sure = item.confidence >= AUTO_PUBLISH;
  // Only the sender who announced an event can change it without review.
  const sameSender = !!match?.sender && !!sender.address && match.sender === sender.address;

  if (item.kind === "reminder") {
    return match ? { action: "reminder", eventId: match.id } : { action: "skip", outcome: "not_event", note };
  }

  if (item.kind === "cancel_event") {
    if (!match) return { action: "skip", outcome: "not_event", note };
    return { action: "cancel", eventId: match.id, apply: sender.trusted && sure && sameSender, confidence: item.confidence, note };
  }

  const { start, end, over, tooFar } = times(item, now);

  if (item.kind === "update_event") {
    if (!match) return { action: "skip", outcome: "not_event", note };
    const before: Change = {};
    const after: Change = {};
    if (start && !over && !tooFar && start.toISOString() !== match.startsIso) {
      before.starts_at = match.startsIso;
      before.ends_at = match.endsIso;
      after.starts_at = start.toISOString();
      if (end) after.ends_at = end.toISOString();
      else if (match.endsIso) {
        // Keep the same length when only the start moves.
        const length = new Date(match.endsIso).getTime() - new Date(match.startsIso).getTime();
        after.ends_at = new Date(start.getTime() + length).toISOString();
      }
    }
    const venue = clip(item.event?.venue, 120);
    if (venue && venue !== match.venue) {
      before.venue = match.venue ?? undefined;
      after.venue = venue;
    }
    if (Object.keys(after).length === 0) return { action: "reminder", eventId: match.id };
    const timeOk = !after.starts_at || item.event?.time_known === true;
    return {
      action: "update",
      eventId: match.id,
      before,
      after,
      apply: sender.trusted && sure && sameSender && timeOk,
      confidence: item.confidence,
      note: note ?? (sameSender ? undefined : "Change sent by someone other than the original announcer"),
    };
  }

  // new_event
  const title = cleanTitle(item.event?.title);
  if (!title || !start) return { action: "skip", outcome: "not_event", note };
  if (over) return { action: "skip", outcome: "past" };
  const url = safeUrl(item.event?.registration_url);
  const reasons = [
    !sender.trusted && "Sender not verified as an IITGN address",
    item.event?.time_known !== true && "Time not given in the email",
    !familiarHost(url) && `Link goes to ${new URL(url!).hostname}`,
    tooFar && "Date is more than a year away",
  ].filter(Boolean) as string[];
  return {
    action: "create",
    fields: {
      title,
      category: item.event?.category ?? "other",
      source_type: "community",
      starts_at: start.toISOString(),
      ends_at: end?.toISOString() ?? null,
      venue: clip(item.event?.venue, 120),
      organiser: clip(item.event?.organiser, 120),
      description: scrubContacts(clip(item.event?.description, 1500)),
      registration_url: url,
    },
    dedupeKey: dedupeKey(title, start),
    publish: sure && reasons.length === 0,
    confidence: item.confidence,
    note: [note, ...reasons].filter(Boolean).join(" · ").slice(0, 280) || undefined,
  };
}

// Strip quoted replies, long encoded lines and blank runs; cap the length.
export function cleanBody(text: string) {
  const lines: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^On .{4,200} wrote:\s*$/.test(line.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break;
    if (line.trimStart().startsWith(">")) continue;
    if (/^[A-Za-z0-9+/=]{120,}$/.test(line.trim())) continue;
    lines.push(line.trimEnd());
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12_000);
}

// "Robotics Club <Robotics@IITGN.ac.in>" -> "robotics@iitgn.ac.in"
export function senderAddress(from: string) {
  const m = from.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/) ?? from.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/);
  const addr = m?.[1]?.toLowerCase() ?? null;
  return addr && addr.length <= 254 && /^[a-z0-9._%+-]+@[a-z0-9.-]+$/.test(addr) ? addr : null;
}
