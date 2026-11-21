import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILE = /^[A-Za-z0-9_-]{16,40}\.webp$/;
const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  if (!UUID.test(id) || !FILE.test(file)) return notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });

  // Row-level security decides who can see this profile (members only,
  // nobody you've blocked or who blocked you).
  const { data } = await supabase.from("profiles").select("avatar_path").eq("id", id).maybeSingle<{ avatar_path: string | null }>();
  const path = `${id}/${file}`;
  if (data?.avatar_path !== path) return notFound();

  // The phone reuses its copy for two minutes, then checks access again
  // (a removed photo, a block or a suspension takes effect within two
  // minutes) and gets "unchanged" without downloading it again.
  const etag = `"${file}"`;
  const cache = {
    "Cache-Control": "private, max-age=120",
    ETag: etag,
    Vary: "Cookie",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: cache });

  const { data: blob, error } = await createAdminClient().storage.from("avatars").download(path);
  if (error || !blob) return notFound();

  return new Response(blob, {
    headers: {
      "Content-Type": "image/webp",
      ...cache,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
