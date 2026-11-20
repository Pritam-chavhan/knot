import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Privileged client. Server-only, never imported by client components.
// Use only for checks that must happen before a user exists (sign-up rules)
// and for account deletion.
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
