import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, makeAdmin, signUp } from "./harness";

let db: PGlite;
let admin: string;
let s1: string;
let s2: string;

const rpc = <T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) =>
  as(db, who, async () => (await db.query<T>(sql, params)).rows);

beforeAll(async () => {
  db = await createDb();
  admin = await signUp(db, "pritam.c@caa.iitgn.ac.in");
  s1 = await signUp(db, "asha.k@iitgn.ac.in");
  s2 = await signUp(db, "ravi.p@iitgn.ac.in");
  await makeAdmin(db, admin);
  await db.query("update public.profiles set is_founder = true where id = $1", [admin]);
  await db.query("update public.profiles set display_name = 'Asha', onboarded_at = now() where id = $1", [s1]);
});

describe("founder dashboard access", () => {
  it("students can't call any admin function", async () => {
    for (const sql of [
      "select public.admin_stats()",
      "select * from public.admin_people()",
      "select * from public.admin_events()",
      "select * from public.admin_log()",
    ]) {
      await expect(rpc(s1, sql)).rejects.toThrow(/not_allowed/);
    }
    await expect(rpc(s1, "select public.admin_set_status($1, 'suspended')", [s2])).rejects.toThrow(/not_allowed/);
    await expect(rpc(s1, "select public.admin_set_role($1, 'admin')", [s1])).rejects.toThrow(/not_allowed/);
  });

  it("students can't read the activity table", async () => {
    await expect(rpc(s1, "select * from public.daily_activity")).rejects.toThrow();
  });
});

describe("numbers", () => {
  it("counts sign-ups, profiles finished and active students", async () => {
    await rpc(s1, "select public.touch_activity()");
    await rpc(s1, "select public.touch_activity()"); // second open in the hour writes nothing
    const [row] = await rpc<{ admin_stats: Record<string, number | unknown[]> }>(admin, "select public.admin_stats()");
    const st = row.admin_stats;
    expect(st.students).toBe(3);
    expect(st.onboarded).toBe(1);
    expect(st.signups_today).toBe(3);
    expect(st.active_today).toBe(1);
    expect((st.daily as unknown[]).length).toBe(30);
  });

  it("finds people by name or email, treating % literally", async () => {
    expect((await rpc(admin, "select * from public.admin_people('asha')")).length).toBe(1);
    expect((await rpc(admin, "select * from public.admin_people('ravi.p@')")).length).toBe(1);
    expect((await rpc(admin, "select * from public.admin_people('%')")).length).toBe(0);
  });
});

describe("controls", () => {
  it("suspends and restores, hides the person, and logs it", async () => {
    await rpc(admin, "select public.admin_set_status($1, 'suspended', 'Spam')", [s2]);
    expect((await rpc(s1, "select id from public.profiles where id = $1", [s2])).length).toBe(0);
    await rpc(admin, "select public.admin_set_status($1, 'active')", [s2]);
    expect((await rpc(s1, "select id from public.profiles where id = $1", [s2])).length).toBe(1);
    const log = await rpc<{ action: string; note: string | null }>(admin, "select action, note from public.admin_log()");
    expect(log.map((l) => l.action)).toEqual(["restore", "suspend_user"]);
    expect(log[1].note).toBe("Spam");
  });

  it("can't suspend or demote yourself", async () => {
    await expect(rpc(admin, "select public.admin_set_status($1, 'suspended')", [admin])).rejects.toThrow(/not_yourself/);
    await expect(rpc(admin, "select public.admin_set_role($1, 'student')", [admin])).rejects.toThrow(/not_yourself/);
  });

  it("makes and removes admins", async () => {
    const role = async () => (await db.query<{ role: string }>("select role from public.profiles where id = $1", [s1])).rows[0].role;
    await rpc(admin, "select public.admin_set_role($1, 'admin')", [s1]);
    expect(await role()).toBe("admin");
    await rpc(admin, "select public.admin_set_role($1, 'student')", [s1]);
    expect(await role()).toBe("student");
  });

  it("hides and restores an event", async () => {
    const [{ id }] = await rpc<{ id: string }>(
      s1,
      "select public.create_hosted_event('Chai run', 'social', now() + interval '1 day', null, 'Tea Post', null, null, 'open') as id",
    );
    await rpc(admin, "select public.admin_event_action($1, 'hide_event', 'Off-topic')", [id]);
    expect((await rpc(s2, "select * from public.event_feed()")).some((r) => r.id === id)).toBe(false);
    await rpc(admin, "select public.admin_event_action($1, 'restore_event')", [id]);
    expect((await rpc(s2, "select * from public.event_feed()")).some((r) => r.id === id)).toBe(true);
  });
});

describe("security review fixes", () => {
  let admin2: string;
  beforeAll(async () => {
    admin2 = await signUp(db, "meera.s@iitgn.ac.in");
    await makeAdmin(db, admin2);
  });

  it("classmates can't read email, last seen or role", async () => {
    for (const col of ["email", "last_seen_at", "role", "is_founder"]) {
      await expect(rpc(s2, `select ${col} from public.profiles where id = $1`, [s1])).rejects.toThrow(/permission denied/);
    }
    const [me] = await rpc<{ email: string }>(s1, "select * from public.my_profile()");
    expect(me.email).toBe("asha.k@iitgn.ac.in");
  });

  it("students can't fake their sign-up or last-seen time", async () => {
    await expect(rpc(s1, "update public.profiles set created_at = now() - interval '1 year' where id = $1", [s1])).rejects.toThrow(/permission denied/);
    await expect(rpc(s1, "update public.profiles set last_seen_at = now() where id = $1", [s1])).rejects.toThrow(/permission denied/);
  });

  it("admins can't edit profiles directly", async () => {
    await rpc(admin2, "update public.profiles set role = 'student', status = 'suspended' where id = $1", [admin]).catch(() => null);
    const { rows } = await db.query<{ role: string; status: string }>("select role, status from public.profiles where id = $1", [admin]);
    expect(rows[0]).toEqual({ role: "admin", status: "active" });
  });

  it("the audit log can't be written, edited or deleted directly", async () => {
    await expect(
      rpc(admin, "insert into public.moderation_actions (admin_id, action, target_type, target_id) values ($1, 'restore', 'profile', $2)", [admin, s1]),
    ).rejects.toThrow(/permission denied/);
    await expect(rpc(admin, "delete from public.moderation_actions")).rejects.toThrow(/permission denied/);
    await expect(db.query("delete from public.moderation_actions")).rejects.toThrow(/append_only/);
  });

  it("only the founder can change another admin, and nobody can change the founder", async () => {
    await expect(rpc(admin2, "select public.admin_set_role($1, 'student')", [admin])).rejects.toThrow(/protected_admin/);
    await expect(rpc(admin2, "select public.admin_set_status($1, 'suspended')", [admin])).rejects.toThrow(/protected_admin/);
    const third = await signUp(db, "kabir.m@iitgn.ac.in");
    await makeAdmin(db, third);
    await expect(rpc(admin2, "select public.admin_set_role($1, 'student')", [third])).rejects.toThrow(/protected_admin/);
    await rpc(admin, "select public.admin_set_role($1, 'student')", [third]);
  });

  it("search treats backslash, % and _ literally", async () => {
    expect(await rpc(admin, "select * from public.admin_people($1)", ["\\%"])).toHaveLength(0);
  });

  it("a suspended student stops counting as active", async () => {
    const s3 = await signUp(db, "dev.r@iitgn.ac.in");
    await rpc(admin, "select public.admin_set_status($1, 'suspended')", [s3]);
    await rpc(s3, "select public.touch_activity()");
    const { rows } = await db.query("select 1 from public.daily_activity where profile_id = $1", [s3]);
    expect(rows).toHaveLength(0);
  });
});
