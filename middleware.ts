import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/security/csp";

const PUBLIC_PATHS = ["/", "/auth/verify", "/auth/callback", "/privacy", "/terms"];

// Runs on every page request:
// 1. sets a fresh Content Security Policy nonce,
// 2. keeps the Supabase session fresh,
// 3. sends signed-out visitors to the landing page.
// Profile and onboarding checks happen in the app layout.
export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const csp = buildCsp({
    nonce,
    supabaseUrl: url,
    dev: process.env.NODE_ENV !== "production",
    https: request.nextUrl.protocol === "https:",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const next = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  let response = next();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Verifies the session token locally with the project's public signing key
  // (no network call), refreshing it first if it has expired.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;

  const path = request.nextUrl.pathname;
  if (!signedIn && !PUBLIC_PATHS.includes(path)) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api/ingest/|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
