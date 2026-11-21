import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, signUp } from "./harness";

let db: PGlite;
let inst: string;
let quiet: string;
let fresh: string;
let halfway: string;
let typo: string;

type Claim = { nudge_id: string; email: string; stage: string; attempt: number };
const claim = async () => (await db.query<Claim>("select * from public.claim_signup_nudges($1, 20)", [inst])).rows;
const finish = (sent: string[], failed: string[] = []) => db.query("select public.finish_signup_nudges($1, $2::uuid[], $3::uuid[])", [inst, sent, failed]);
const ago = (id: string, minutes: number) => db.query("update public.profiles set created_at = now() - make_interval(mins => $2) where id = $1", [id, minutes]);
const sentAgo = (id: string, minutes: number) => db.query("update public.signup_nudges set sent_at = now() - make_interval(mins => $2) where profile_id = $1", [id, minutes]);

beforeAll(async () => {
  db = await createDb();
  inst = (await db.query<{ id: string }>("select id from public.institutions where email_domain = 'iitgn.ac.in'")).rows[0].id;
  quiet = await signUp(db, "quiet.one@iitgn.ac.in");
  fresh = await signUp(db, "just.now@iitgn.ac.in");
  halfway = await signUp(db, "half.way@iitgn.ac.in");
  await db.query("update auth.users set email_confirmed_at = now() - interval '25 minutes' where id = $1", [halfway]);
  // A mistyped address, then the same student with the right one, who got in.
  typo = await signUp(db, "lavudya.santhish@iitgn.ac.in");
  const right = await signUp(db, "lavudya.santhosh@iitgn.ac.in");
  await db.query("update public.profiles set display_name = 'Lavudya', onboarded_at = now() where id = $1", [right]);
  for (const id of [quiet, typo]) await ago(id, 20);
  await ago(halfway, 30);
});

describe("sign-up helper", () => {
  it("emails people stuck past the wait, and nobody else", async () => {
    const first = await claim();
    expect(first.map((c) => [c.email, c.stage, c.attempt]).sort()).toEqual([
      ["half.way@iitgn.ac.in", "verified", 1],
      ["quiet.one@iitgn.ac.in", "code_sent", 1],
    ]);
    // Claimed emails aren't handed out twice.
    expect(await claim()).toEqual([]);
    await finish(first.map((c) => c.nudge_id));
    expect(fresh).toBeTruthy();
  });

  it("sends one follow-up an hour later, then stops", async () => {
    expect(await claim()).toEqual([]);
    await sentAgo(quiet, 61);
    await ago(quiet, 90);
    const second = await claim();
    expect(second).toEqual([expect.objectContaining({ email: "quiet.one@iitgn.ac.in", attempt: 2 })]);
    await finish(second.map((c) => c.nudge_id));
    await sentAgo(quiet, 200);
    expect(await claim()).toEqual([]);
  });

  it("tells the founder about anyone still stuck after both emails, once", async () => {
    const flagged = (await db.query<{ email: string }>("select * from public.escalate_signup_nudges($1)", [inst])).rows;
    expect(flagged.map((f) => f.email)).toEqual(["quiet.one@iitgn.ac.in"]);
    expect((await db.query("select * from public.escalate_signup_nudges($1)", [inst])).rows).toEqual([]);
  });

  it("stops as soon as someone joins, and doesn't retry an address that failed", async () => {
    await db.query("update public.profiles set display_name = 'Half', onboarded_at = now() where id = $1", [halfway]);
    await db.query("update public.signup_nudges set sent_at = now() - interval '2 hours' where profile_id = $1", [halfway]);
    expect((await claim()).map((c) => c.email)).not.toContain("half.way@iitgn.ac.in");

    const late = await signUp(db, "late.comer@iitgn.ac.in");
    await ago(late, 20);
    const [c] = await claim();
    expect(c.email).toBe("late.comer@iitgn.ac.in");
    await finish([], [c.nudge_id]);
    await db.query("update public.profiles set created_at = now() - interval '3 hours' where id = $1", [late]);
    expect((await claim()).map((x) => x.email)).not.toContain("late.comer@iitgn.ac.in");
  });

  it("can't be used by students", async () => {
    await expect(as(db, quiet, () => db.query("select * from public.claim_signup_nudges($1, 5)", [inst]))).rejects.toThrow(/permission denied/);
    await expect(as(db, quiet, () => db.query("select * from public.signup_nudges"))).rejects.toThrow(/permission denied/);
  });
});
