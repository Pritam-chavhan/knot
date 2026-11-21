import { describe, expect, it } from "vitest";
import { buildCsp, SECURITY_HEADERS } from "@/lib/security/csp";

const base = { nonce: "abc123", supabaseUrl: "https://proj.supabase.co" };

describe("content security policy", () => {
  it("only runs scripts that carry the nonce in production", () => {
    const csp = buildCsp({ ...base, dev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("allows Supabase over https and websockets, and nothing else remote", () => {
    const csp = buildCsp({ ...base, dev: false });
    expect(csp).toContain("connect-src 'self' https://proj.supabase.co wss://proj.supabase.co");
  });

  it("loads map images only from OpenStreetMap's tile server", () => {
    const csp = buildCsp({ ...base, dev: false });
    expect(csp).toContain("img-src 'self' data: blob: https://tile.openstreetmap.org;");
    expect(csp).not.toMatch(/img-src[^;]*\*/);
  });

  it("cannot be framed and blocks plugins", () => {
    const csp = buildCsp({ ...base, dev: false });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("only allows location for our own pages", () => {
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("geolocation=(self)");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });
});
