import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, makeAdmin, signUp } from "./harness";

let db: PGlite;
let admin: string;
let started: string;
let verified: string;
let joined: string;

type Row = { email: string; stage: string; verified_at: string | null; joined_at: string | null };
const run = <T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) =>
  as(db, who, async () => (await db.query<T>(sql, params)).rows);

beforeAll(async () => {
  db = await createDb();
  admin = await signUp(db, "pritam.c@iitgn.ac.in");
  await db.query("update public.profiles set display_name = 'Pritam', onboarded_at = now() where id = $1", [admin]);
  await makeAdmin(db, admin);
  started = await signUp(db, "new.one@iitgn.ac.in");
  verified = await signUp(db, "half.way@iitgn.ac.in");
  await db.query("update auth.users set email_confirmed_at = now() where id = $1", [verified]);
  joined = await signUp(db, "all.done@iitgn.ac.in");
  await db.query("update auth.users set email_confirmed_at = now() where id = $1", [joined]);
  await db.query("update public.profiles set display_name = 'All Done', onboarded_at = now() where id = $1", [joined]);
  await db.query("insert into public.institutions (name, email_domain) values ('Other', 'other.ac.in')");
  await signUp(db, "x.y@other.ac.in");
});

describe("sign-up list", () => {
  it("shows admins every sign-up at their college and how far each got", async () => {
    const rows = await run<Row>(admin, "select email, stage, verified_at, joined_at from public.admin_signups()");
    const by = Object.fromEntries(rows.map((r) => [r.email, r.stage]));
    expect(by).toMatchObject({ "new.one@iitgn.ac.in": "code_sent", "half.way@iitgn.ac.in": "verified", "all.done@iitgn.ac.in": "joined" });
    expect(by["x.y@other.ac.in"]).toBeUndefined();
  });

  it("is admins only", async () => {
    await expect(run(joined, "select * from public.admin_signups()")).rejects.toThrow(/not_allowed/);
    await expect(run(started, "select * from public.admin_signups()")).rejects.toThrow(/not_allowed/);
  });
});
