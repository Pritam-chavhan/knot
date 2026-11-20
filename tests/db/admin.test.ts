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

describe("email feed", () => {
  const inst = async () => (await db.query<{ id: string }>("select id from public.institutions limit 1")).rows[0].id;
  const claim = async (hash: string) => (await db.query<{ id: string | null; state: string; attempts: number }>("select * from public.ingest_claim($1, $2)", [await inst(), hash])).rows[0];

  it("students can't read the mail log or the ingest token hash", async () => {
    await db.query("update public.institutions set ingest_token_hash = repeat('a', 64)");
    await expect(rpc(s1, "select ingest_token_hash from public.institutions")).rejects.toThrow(/permission denied/);
    await expect(rpc(s1, "select ingest_official_senders from public.institutions")).rejects.toThrow(/permission denied/);
    expect(await rpc(s1, "select name from public.institutions")).toHaveLength(1);
    await expect(rpc(s1, "insert into public.source_announcements (institution_id, raw_text) select id, 'x' from public.institutions")).rejects.toThrow(/permission denied/);
    await expect(rpc(s1, "select * from public.admin_inbox()")).rejects.toThrow(/not_allowed/);
    await expect(rpc(s1, "select public.admin_inbox_stats()")).rejects.toThrow(/not_allowed/);
    await expect(rpc(s1, "select * from public.ingest_claim($1, repeat('d', 64))", [await inst()])).rejects.toThrow(/permission denied/);
  });

  it("skipped mail can't keep any text", async () => {
    await expect(
      db.query("insert into public.source_announcements (institution_id, raw_text, subject, outcome, message_hash) select id, 'secret', 'Re: marks', 'not_event', repeat('b', 64) from public.institutions"),
    ).rejects.toThrow(/no_text_when_skipped/);
  });

  it("claims each mail once, and takes over a claim left hanging for 3 minutes", async () => {
    const hash = "e".repeat(64);
    const first = await claim(hash);
    expect(first).toMatchObject({ state: "claimed", attempts: 1 });
    expect(await claim(hash)).toMatchObject({ id: null, state: "in_progress" });
    await db.query("update public.source_announcements set received_at = now() - interval '4 minutes' where id = $1", [first.id]);
    expect(await claim(hash)).toMatchObject({ id: first.id, state: "claimed", attempts: 2 });
    await db.query("update public.source_announcements set outcome = 'not_event' where id = $1", [first.id]);
    expect(await claim(hash)).toMatchObject({ id: null, state: "seen" });
  });

  it("official events from mail need a recorded sender or a person", async () => {
    await expect(
      db.query("insert into public.events (institution_id, source_type, title, category, starts_at) select id, 'official', 'No source', 'talk', now() + interval '1 day' from public.institutions"),
    ).rejects.toThrow(/events_official_verified/);
    await db.query("insert into public.events (institution_id, source_type, title, category, starts_at, mail_sender) select id, 'official', 'From the dean', 'talk', now() + interval '1 day', 'dosa@iitgn.ac.in' from public.institutions");
  });

  it("lets admins review, edit and publish, but not revive cancelled events", async () => {
    const { rows } = await db.query<{ id: string }>(
      "insert into public.source_announcements (institution_id, raw_text, subject, from_address, outcome, message_hash, sender_verified) select id, 'Talk on Friday', 'Talk', 'Robotics <robotics@iitgn.ac.in>', 'needs_review', repeat('c', 64), true from public.institutions returning id",
    );
    const ev = await db.query<{ id: string }>(
      "insert into public.events (institution_id, source_type, source_announcement_id, title, category, starts_at, review_status, mail_sender) select id, 'community', $1, 'Guest talk', 'talk', now() + interval '2 days', 'pending', 'robotics@iitgn.ac.in' from public.institutions returning id",
      [rows[0].id],
    );
    await db.query("update public.source_announcements set event_id = $1 where id = $2", [ev.rows[0].id, rows[0].id]);
    const inbox = await rpc<{ outcome: string; event_title: string; sender_verified: boolean; sender_official: boolean }>(admin, "select * from public.admin_inbox()");
    expect(inbox[0]).toMatchObject({ outcome: "needs_review", event_title: "Guest talk", sender_verified: true, sender_official: false });

    await rpc(admin, "select public.admin_save_event($1, 'community', 'Guest talk: robots', 'talk', now() + interval '2 days', null, 'AB 1/101', 'Robotics Club', null, null)", [ev.rows[0].id]);
    const saved = await db.query<{ title: string; review_status: string }>("select title, review_status from public.events where id = $1", [ev.rows[0].id]);
    expect(saved.rows[0]).toEqual({ title: "Guest talk: robots", review_status: "approved" });
    const log = await db.query("select 1 from public.moderation_actions where action = 'edit_event' and target_id = $1", [ev.rows[0].id]);
    expect(log.rows).toHaveLength(1);

    await db.query("update public.events set status = 'cancelled' where id = $1", [ev.rows[0].id]);
    await expect(
      rpc(admin, "select public.admin_save_event($1, 'community', 'Back again', 'talk', now() + interval '2 days', null, 'AB', null, null, null)", [ev.rows[0].id]),
    ).rejects.toThrow(/not_editable/);
    await expect(rpc(s1, "select public.admin_save_event($1, 'community', 'Mine now', 'talk', now() + interval '2 days', null, 'AB', null, null, null)", [ev.rows[0].id])).rejects.toThrow(/not_allowed/);
  });

  it("applies a proposed change only when an admin says so, once", async () => {
    const ev = await db.query<{ id: string }>(
      "insert into public.events (institution_id, source_type, title, category, starts_at, venue, mail_sender) select id, 'community', 'Open mic', 'music', now() + interval '3 days', 'Central arcade', 'music@iitgn.ac.in' from public.institutions returning id",
    );
    const { rows } = await db.query<{ id: string }>(
      `insert into public.source_announcements (institution_id, raw_text, subject, from_address, outcome, message_hash, event_id, proposal)
       select id, 'Venue moved', 'Venue change', 'someone@iitgn.ac.in', 'needs_review', repeat('f', 64), $1,
              jsonb_build_object('kind', 'update', 'before', jsonb_build_object('venue', 'Central arcade'), 'after', jsonb_build_object('venue', 'Jasubhai Auditorium'))
       from public.institutions returning id`,
      [ev.rows[0].id],
    );
    await expect(rpc(s1, "select public.admin_resolve_proposal($1, true)", [rows[0].id])).rejects.toThrow(/not_allowed/);
    expect((await db.query<{ venue: string }>("select venue from public.events where id = $1", [ev.rows[0].id])).rows[0].venue).toBe("Central arcade");
    await rpc(admin, "select public.admin_resolve_proposal($1, true)", [rows[0].id]);
    expect((await db.query<{ venue: string }>("select venue from public.events where id = $1", [ev.rows[0].id])).rows[0].venue).toBe("Jasubhai Auditorium");
    await expect(rpc(admin, "select public.admin_resolve_proposal($1, true)", [rows[0].id])).rejects.toThrow(/not_found/);
  });

  it("keeps a list of official senders", async () => {
    await rpc(admin, "select public.admin_set_official_sender('DoSA@IITGN.ac.in', true)");
    await rpc(admin, "select public.admin_set_official_sender('dosa@iitgn.ac.in', true)");
    const { rows } = await db.query<{ s: string[] }>("select ingest_official_senders s from public.institutions");
    expect(rows[0].s).toEqual(["dosa@iitgn.ac.in"]);
    await expect(rpc(admin, "select public.admin_set_official_sender('not an address', true)")).rejects.toThrow(/bad_address/);
    await expect(rpc(s1, "select public.admin_set_official_sender('x@iitgn.ac.in', true)")).rejects.toThrow(/not_allowed/);
  });

  it("erases kept mail text after 30 days", async () => {
    await db.query("update public.source_announcements set processed_at = now() - interval '31 days' where raw_text is not null");
    const { rows } = await db.query<{ n: number }>("select public.ingest_purge_text() as n");
    expect(rows[0].n).toBeGreaterThan(0);
    const left = await db.query("select 1 from public.source_announcements where raw_text is not null or subject is not null");
    expect(left.rows).toHaveLength(0);
  });

  it("lets a real announcement through after a same-named event was discarded", async () => {
    const make = (review: string) =>
      db.query(
        "insert into public.events (institution_id, source_type, title, category, starts_at, dedupe_key, review_status) select id, 'community', 'Keynote', 'talk', now() + interval '5 days', 'mail:x:keynote', $1 from public.institutions",
        [review],
      );
    await make("rejected");
    await make("pending");
    await expect(make("pending")).rejects.toThrow(/events_dedupe/);
  });
});
