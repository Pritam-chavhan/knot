import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isInstitutionDomain } from "@/features/auth/validation";
import { toIstLocalInput } from "@/lib/time";
import { extractEvents, ExtractionFailed, type Candidate } from "./extract";
import { cleanBody, decideItem, senderAddress, type Decision, type Sender } from "./decide";

export type IncomingMail = { id: string; from: string; subject: string; date: string; body: string; verified: boolean };
export type Institution = { id: string; email_domain: string; ingest_official_senders: string[] };
export type Outcome = "published" | "needs_review" | "updated" | "cancelled" | "duplicate" | "not_event" | "past" | "error" | "seen" | "in_progress";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const RANK = ["needs_review", "published", "updated", "cancelled", "duplicate", "past", "not_event"] as const;
const SKIPPED = new Set<string>(["not_event", "past", "duplicate"]);
const MAX_ATTEMPTS = 5;

function senderOf(mail: IncomingMail, inst: Institution): Sender {
  const address = senderAddress(mail.from);
  const domain = address?.split("@")[1] ?? "";
  const trusted = mail.verified && !!address && isInstitutionDomain(domain, inst.email_domain);
  return { trusted, official: trusted && inst.ingest_official_senders.includes(address!), address };
}

async function knownEvents(admin: SupabaseClient, institutionId: string, now: Date): Promise<Candidate[]> {
  const { data, error } = await admin
    .from("events")
    .select("id, title, starts_at, ends_at, venue, mail_sender")
    .eq("institution_id", institutionId)
    .in("status", ["published", "full"])
    .in("review_status", ["approved", "pending"])
    .neq("source_type", "student_hosted")
    .gte("starts_at", new Date(now.getTime() - 6 * 3600_000).toISOString())
    .lte("starts_at", new Date(now.getTime() + 120 * 24 * 3600_000).toISOString())
    .order("starts_at")
    .limit(60);
  if (error) throw new Error(`known_events: ${error.message}`);
  return (data ?? []).map((e, i) => ({
    ref: `E${i + 1}`,
    id: e.id,
    title: e.title,
    starts_at: toIstLocalInput(new Date(e.starts_at)),
    venue: e.venue,
    startsIso: new Date(e.starts_at).toISOString(),
    endsIso: e.ends_at ? new Date(e.ends_at).toISOString() : null,
    sender: e.mail_sender,
  }));
}

type Applied = { outcome: (typeof RANK)[number]; eventId?: string; proposal?: object; note?: string; confidence?: number };

async function apply(admin: SupabaseClient, inst: Institution, announcementId: string, d: Decision, sender: Sender): Promise<Applied> {
  switch (d.action) {
    case "skip":
      return { outcome: d.outcome };
    case "reminder":
      return { outcome: "duplicate", eventId: d.eventId };
    case "create": {
      const row = {
        institution_id: inst.id,
        source_announcement_id: announcementId,
        ...d.fields,
        mail_sender: sender.address,
        review_status: d.publish ? "approved" : "pending",
        extraction_confidence: d.confidence,
        dedupe_key: d.dedupeKey,
      };
      const { data, error } = await admin.from("events").insert(row).select("id").single();
      if (!error && data) return { outcome: d.publish ? "published" : "needs_review", eventId: data.id, note: d.note, confidence: d.confidence };
      if (error?.code !== "23505") throw new Error(`event_insert: ${error?.message}`);

      // Same name, same day. If it's ours (an earlier attempt of this same
      // mail), carry on; if another sender holds it, don't let them squat on
      // a verified announcement.
      const { data: existing } = await admin
        .from("events")
        .select("id, source_announcement_id, mail_sender")
        .eq("institution_id", inst.id)
        .eq("dedupe_key", d.dedupeKey)
        .neq("review_status", "rejected")
        .neq("status", "cancelled")
        .maybeSingle();
      if (existing?.source_announcement_id === announcementId) {
        return { outcome: d.publish ? "published" : "needs_review", eventId: existing.id, note: d.note, confidence: d.confidence };
      }
      if (existing && sender.trusted && existing.mail_sender !== sender.address) {
        const { data: second, error: e2 } = await admin
          .from("events")
          .insert({ ...row, dedupe_key: null, review_status: "pending" })
          .select("id")
          .single();
        if (e2 || !second) throw new Error(`event_insert: ${e2?.message}`);
        return { outcome: "needs_review", eventId: second.id, note: "Same name and day as an event from another sender", confidence: d.confidence };
      }
      return { outcome: "duplicate", eventId: existing?.id };
    }
    case "update": {
      if (!d.apply) {
        return { outcome: "needs_review", eventId: d.eventId, proposal: { kind: "update", before: d.before, after: d.after }, note: d.note, confidence: d.confidence };
      }
      const { error } = await admin.from("events").update(d.after).eq("id", d.eventId).eq("institution_id", inst.id).neq("source_type", "student_hosted");
      if (error) throw new Error(`event_update: ${error.message}`);
      // The previous values stay on the announcement as the record of what changed.
      return { outcome: "updated", eventId: d.eventId, proposal: { kind: "update", before: d.before, after: d.after, resolved: true, applied: true, auto: true }, confidence: d.confidence };
    }
    case "cancel": {
      if (!d.apply) {
        return { outcome: "needs_review", eventId: d.eventId, proposal: { kind: "cancel", before: {}, after: {} }, note: d.note ?? "Mail says this event is cancelled", confidence: d.confidence };
      }
      const { error } = await admin.from("events").update({ status: "cancelled" }).eq("id", d.eventId).eq("institution_id", inst.id).neq("source_type", "student_hosted");
      if (error) throw new Error(`event_cancel: ${error.message}`);
      return { outcome: "cancelled", eventId: d.eventId, proposal: { kind: "cancel", before: {}, after: {}, resolved: true, applied: true, auto: true }, confidence: d.confidence };
    }
  }
}

async function finish(admin: SupabaseClient, id: string, values: Record<string, unknown>) {
  const { error } = await admin
    .from("source_announcements")
    .update({ ...values, processed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`finish: ${error.message}`);
}

// Processes one mail. Throws ExtractionUnavailable when the AI can't be
// reached: the claim then stays pending and is retried after 3 minutes.
export async function processMail(admin: SupabaseClient, inst: Institution, mail: IncomingMail, now = new Date()): Promise<Outcome> {
  const { data: claims, error: claimError } = await admin.rpc("ingest_claim", {
    p_institution: inst.id,
    p_hash: sha256(`${inst.id}:${mail.id.trim()}`),
  });
  if (claimError) throw new Error(`claim: ${claimError.message}`);
  const claim = (claims as { id: string | null; state: string; attempts: number }[])[0];
  if (!claim?.id) return claim?.state === "in_progress" ? "in_progress" : "seen";

  const sender = senderOf(mail, inst);
  const body = cleanBody(mail.body);
  const keep = { from_address: mail.from.slice(0, 300), subject: mail.subject.slice(0, 300), sender_verified: sender.trusted };

  if (claim.attempts > MAX_ATTEMPTS) {
    await finish(admin, claim.id, { ...keep, outcome: "error", status: "rejected", ai_note: "Gave up after several attempts. Add it by hand if it's an event." });
    return "error";
  }

  // One list for both the AI and the decisions, so refs always match.
  const known = await knownEvents(admin, inst.id, now);
  let extraction;
  try {
    const sent = new Date(mail.date);
    extraction = await extractEvents(
      { from: mail.from, subject: mail.subject, sentAt: toIstLocalInput(Number.isNaN(sent.getTime()) ? now : sent), body },
      known,
      toIstLocalInput(now).slice(0, 10),
    );
  } catch (e) {
    if (!(e instanceof ExtractionFailed)) throw e;
    await finish(admin, claim.id, { ...keep, outcome: "error", status: "rejected", ai_note: "The AI couldn't read this mail. Add it by hand if it's an event." });
    return "error";
  }

  const results: Applied[] = [];
  for (const item of extraction.items) {
    results.push(await apply(admin, inst, claim.id, decideItem(item, known, now, sender), sender));
  }

  const outcome = results.length ? RANK.find((o) => results.some((r) => r.outcome === o))! : "not_event";
  const lead = results.find((r) => r.outcome === outcome);
  if (SKIPPED.has(outcome)) {
    await finish(admin, claim.id, { outcome, status: "rejected", raw_text: null, subject: null, from_address: null, sender_verified: null });
  } else {
    await finish(admin, claim.id, {
      ...keep,
      outcome,
      status: "parsed",
      raw_text: body,
      confidence: Math.max(0, ...results.map((r) => r.confidence ?? 0)) || null,
      ai_note: results.map((r) => r.note).filter(Boolean).join(" · ").slice(0, 300) || null,
      event_id: lead?.eventId ?? null,
      proposal: lead?.proposal ?? null,
    });
  }
  return outcome;
}
