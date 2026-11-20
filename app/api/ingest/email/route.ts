import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExtractionUnavailable } from "@/features/ingest/extract";
import { processMail, type Institution, type Outcome } from "@/features/ingest/process";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 600_000;
// Stop starting new mails after this long; the rest come back next run.
const TIME_BUDGET_MS = 35_000;
// Flood cap: mails taken in per hour.
const HOURLY_CAP = 300;

// Oversized fields are trimmed, not rejected, so one odd mail can't block a batch.
const text = (max: number) =>
  z
    .string()
    .default("")
    .transform((v) => v.slice(0, max));
const batchSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(998),
        from: text(500),
        subject: text(1000),
        date: text(100),
        body: text(30_000),
        verified: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(10),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function institutionFor(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{40,128})$/)?.[1];
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data } = await admin
    .from("institutions")
    .select("id, email_domain, ingest_official_senders")
    .eq("ingest_token_hash", hash)
    .maybeSingle<Institution>();
  return data ? { admin, inst: data } : null;
}

export async function POST(request: Request) {
  const started = Date.now();
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) return json(413, { error: "too_large" });

  const auth = await institutionFor(request);
  if (!auth) {
    console.warn("ingest_unauthorized");
    return json(401, { error: "unauthorized" });
  }

  let raw: ArrayBuffer;
  try {
    raw = await request.arrayBuffer();
  } catch {
    return json(400, { error: "bad_request" });
  }
  if (raw.byteLength > MAX_BODY_BYTES) return json(413, { error: "too_large" });
  let parsed;
  try {
    parsed = batchSchema.safeParse(JSON.parse(new TextDecoder().decode(raw)));
  } catch {
    return json(400, { error: "bad_json" });
  }
  if (!parsed.success) return json(400, { error: "bad_request" });

  const { admin, inst } = auth;
  const { data: recent } = await admin.rpc("ingest_recent_calls", { p_institution: inst.id });
  if (typeof recent === "number" && recent >= HOURLY_CAP) return json(503, { error: "busy" });
  // Housekeeping: erase mail text older than 30 days.
  await admin.rpc("ingest_purge_text");

  const results: { id: string; outcome: Outcome | "deferred" }[] = [];
  let failure: unknown = null;
  for (const mail of parsed.data.messages) {
    if (failure || Date.now() - started > TIME_BUDGET_MS) {
      results.push({ id: mail.id, outcome: "deferred" });
      continue;
    }
    try {
      results.push({ id: mail.id, outcome: await processMail(admin, inst, mail) });
    } catch (e) {
      failure = e;
      results.push({ id: mail.id, outcome: "deferred" });
    }
  }

  if (results.some((r) => ["published", "updated", "cancelled", "needs_review"].includes(r.outcome))) revalidatePath("/", "layout");
  if (failure) {
    const retry = failure instanceof ExtractionUnavailable;
    // Short codes only: never log mail content.
    console.error("ingest_failed", retry ? (failure as Error).message : "processing_error");
    return json(retry ? 503 : 500, { error: retry ? "try_later" : "failed", results });
  }
  return json(200, { results });
}
