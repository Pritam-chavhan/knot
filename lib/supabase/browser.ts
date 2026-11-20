import { createBrowserClient } from "@supabase/ssr";

// Browser client for live updates only. It acts as the signed-in student, so
// row-level security decides which changes reach them.
let client: ReturnType<typeof createBrowserClient> | null = null;
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createBrowserClient(url, key);
  return client;
}
