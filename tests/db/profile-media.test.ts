import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, signUp } from "./harness";

let db: PGlite;
let asha: string;
let ravi: string;

const run = <T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) =>
  as(db, who, async () => (await db.query<T>(sql, params)).rows);

beforeAll(async () => {
  db = await createDb();
  asha = await signUp(db, "asha.k@iitgn.ac.in");
  ravi = await signUp(db, "ravi.p@iitgn.ac.in");
  await db.query("update public.profiles set display_name = 'Asha', onboarded_at = now() where id = $1", [asha]);
});

describe("links", () => {
  it("students can add their own usernames, and classmates can see them", async () => {
    await run(asha, "update public.profiles set github = 'asha-k', instagram = 'asha.k_', linkedin = 'asha-kumar-123' where id = $1", [asha]);
    const [row] = await run<{ github: string; instagram: string; linkedin: string }>(
      ravi,
      "select github, instagram, linkedin from public.profiles where id = $1",
      [asha],
    );
    expect(row).toEqual({ github: "asha-k", instagram: "asha.k_", linkedin: "asha-kumar-123" });
  });

  it("only usernames are accepted, never URLs or scripts", async () => {
    for (const [col, value] of [
      ["github", "https://evil.example"],
      ["github", "-starts-with-dash"],
      ["github", "two--dashes"],
      ["instagram", "javascript:alert(1)"],
      ["instagram", "a".repeat(31)],
      ["linkedin", "in/asha"],
      ["linkedin", "ab"],
    ]) {
      await expect(run(asha, `update public.profiles set ${col} = $2 where id = $1`, [asha, value])).rejects.toThrow(/check constraint/);
    }
  });

  it("can't be written on someone else's profile", async () => {
    await run(ravi, "update public.profiles set github = 'hacked' where id = $1", [asha]);
    const { rows } = await db.query<{ github: string }>("select github from public.profiles where id = $1", [asha]);
    expect(rows[0].github).toBe("asha-k");
  });
});

describe("photos", () => {
  const file = (owner: string) => `${owner}/AbCdEfGhIjKlMnOpQrSt.webp`;

  it("can't be set by writing the column directly", async () => {
    await expect(run(asha, "update public.profiles set avatar_path = $2 where id = $1", [asha, file(asha)])).rejects.toThrow(/permission denied/);
  });

  it("students can't call the photo function, even for themselves", async () => {
    await expect(run(asha, "select public.set_avatar($1, $2)", [asha, file(asha)])).rejects.toThrow(/permission denied/);
    await expect(run(asha, "select public.set_avatar($1, null)", [asha])).rejects.toThrow(/permission denied/);
  });

  it("only accepts a file in that student's own folder", async () => {
    await expect(db.query("select public.set_avatar($1, $2)", [asha, file(ravi)])).rejects.toThrow(/bad_path/);
    await expect(db.query("select public.set_avatar($1, $2)", [asha, `${asha}/../x.webp`])).rejects.toThrow();
  });

  it("returns the previous photo so it can be deleted, and can be removed", async () => {
    const first = (await db.query<{ old: string | null }>("select public.set_avatar($1, $2) as old", [asha, file(asha)])).rows[0];
    expect(first.old).toBeNull();
    const second = `${asha}/ZyXwVuTsRqPoNmLkJiHg.webp`;
    const replaced = (await db.query<{ old: string }>("select public.set_avatar($1, $2) as old", [asha, second])).rows[0];
    expect(replaced.old).toBe(file(asha));
    const [me] = await run<{ avatar_path: string }>(asha, "select avatar_path from public.my_profile()");
    expect(me.avatar_path).toBe(second);
    await db.query("select public.set_avatar($1, null)", [asha]);
    const [gone] = await run<{ avatar_path: string | null }>(ravi, "select avatar_path from public.profiles where id = $1", [asha]);
    expect(gone.avatar_path).toBeNull();
  });

  it("refuses suspended accounts", async () => {
    await db.query("update public.profiles set status = 'suspended' where id = $1", [ravi]);
    await expect(db.query("select public.set_avatar($1, $2)", [ravi, file(ravi)])).rejects.toThrow(/not_found/);
    await db.query("update public.profiles set status = 'active' where id = $1", [ravi]);
  });
});
