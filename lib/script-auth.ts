import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ScriptInstitution = { id: string; email_domain: string; ingest_official_senders: string[] | null };

// Finds the college whose campus-mail script sent this request. The script
// keeps a private token; KNOT stores only its SHA-256 fingerprint.
export async function institutionForScript(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{40,128})$/)?.[1];
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data } = await admin
    .from("institutions")
    .select("id, email_domain, ingest_official_senders")
    .eq("ingest_token_hash", hash)
    .maybeSingle<ScriptInstitution>();
  return data ? { admin, inst: data } : null;
}
