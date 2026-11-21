import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, makeAdmin, signUp } from "./harness";

let db: PGlite;
let asha: string;
let ravi: string;
let meera: string;
let kabir: string;
let admin: string;
let outsider: string;

const run = <T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) =>
  as(db, who, async () => (await db.query<T>(sql, params)).rows);
const one = async <T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) =>
  (await run<T>(who, sql, params))[0];
const state = async (who: string, other: string) =>
  (await one<{ r: { state: string } }>(who, "select public.relationship_with($1) r", [other])).r.state;

async function student(email: string, name: string) {
  const id = await signUp(db, email);
  await db.query("update public.profiles set display_name = $2, onboarded_at = now() where id = $1", [id, name]);
  return id;
}

async function connect(a: string, b: string) {
  await run(a, "select public.send_connection_request($1)", [b]);
  const r = await one<{ r: { connection_id: string } }>(b, "select public.send_connection_request($1) r", [a]);
  return r.r.connection_id;
}

beforeAll(async () => {
  db = await createDb();
  asha = await student("asha.k@iitgn.ac.in", "Asha");
  ravi = await student("ravi.p@iitgn.ac.in", "Ravi");
  meera = await student("meera.s@iitgn.ac.in", "Meera");
  kabir = await student("kabir.m@iitgn.ac.in", "Kabir");
  admin = await student("pritam.c@caa.iitgn.ac.in", "Pritam");
  await makeAdmin(db, admin);
  // A student at another institution.
  await db.query("insert into public.institutions (name, email_domain) values ('Other', 'other.ac.in')");
  outsider = await student("x.y@other.ac.in", "Outsider");
});

describe("connection requests", () => {
  it("can't be written directly", async () => {
    await expect(
      run(asha, "insert into public.connection_requests (from_id, to_id, context) values ($1, $2, 'people')", [asha, ravi]),
    ).rejects.toThrow(/permission denied/);
  });

  it("go to classmates only: not yourself, not other colleges, not unfinished profiles", async () => {
    await expect(run(asha, "select public.send_connection_request($1)", [asha])).rejects.toThrow(/not_found/);
    await expect(run(asha, "select public.send_connection_request($1)", [outsider])).rejects.toThrow(/not_found/);
    const half = await signUp(db, "half.done@iitgn.ac.in");
    await expect(run(asha, "select public.send_connection_request($1)", [half])).rejects.toThrow(/not_found/);
  });

  it("show as requested, and sending twice doesn't create a second request", async () => {
    expect(await state(asha, ravi)).toBe("none");
    await run(asha, "select public.send_connection_request($1, 'Saw you at Hallabol!')", [ravi]);
    await run(asha, "select public.send_connection_request($1)", [ravi]);
    expect(await state(asha, ravi)).toBe("requested");
    expect(await state(ravi, asha)).toBe("incoming");
    const reqs = await run<{ display_name: string; note: string }>(ravi, "select display_name, note from public.my_connection_requests()");
    expect(reqs).toEqual([{ display_name: "Asha", note: "Saw you at Hallabol!" }]);
    expect(await run(meera, "select * from public.my_connection_requests()")).toHaveLength(0);
  });

  it("connect both people straight away when they've asked each other", async () => {
    const r = await one<{ r: { state: string; connection_id: string } }>(ravi, "select public.send_connection_request($1) r", [asha]);
    expect(r.r.state).toBe("connected");
    expect(await state(asha, ravi)).toBe("connected");
    expect(await run(ravi, "select * from public.my_connection_requests()")).toHaveLength(0);
  });

  it("can only be answered by the person they were sent to", async () => {
    await run(meera, "select public.send_connection_request($1)", [kabir]);
    const [{ request_id }] = await run<{ request_id: string }>(kabir, "select request_id from public.my_connection_requests()");
    await expect(run(meera, "select public.respond_connection_request($1, true)", [request_id])).rejects.toThrow(/not_allowed/);
    await expect(run(asha, "select public.respond_connection_request($1, true)", [request_id])).rejects.toThrow(/not_allowed/);
  });

  it("don't tell the sender they were declined, and can't be repeated after a decline", async () => {
    const [{ request_id }] = await run<{ request_id: string }>(kabir, "select request_id from public.my_connection_requests()");
    await run(kabir, "select public.respond_connection_request($1, false)", [request_id]);
    expect(await state(meera, kabir)).toBe("requested");
    await run(meera, "select public.send_connection_request($1)", [kabir]);
    expect(await run(kabir, "select * from public.my_connection_requests()")).toHaveLength(0);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.connection_requests where from_id = $1 and to_id = $2", [meera, kabir]);
    expect(rows[0].n).toBe(1);
  });

  it("respect people who turned requests off", async () => {
    await db.query("update public.privacy_settings set allow_requests = false where profile_id = $1", [kabir]);
    expect(await state(asha, kabir)).toBe("closed");
    await expect(run(asha, "select public.send_connection_request($1)", [kabir])).rejects.toThrow(/not_accepting/);
    await db.query("update public.privacy_settings set allow_requests = true where profile_id = $1", [kabir]);
  });

  it("can be cancelled by the sender", async () => {
    await run(asha, "select public.send_connection_request($1)", [kabir]);
    await run(asha, "select public.cancel_connection_request($1)", [kabir]);
    expect(await state(asha, kabir)).toBe("none");
    expect(await run(kabir, "select * from public.my_connection_requests()")).toHaveLength(0);
  });

  it("notes are limited to 140 characters", async () => {
    await expect(run(asha, "select public.send_connection_request($1, $2)", [kabir, "a".repeat(141)])).rejects.toThrow(/note_too_long/);
  });
});

describe("messages", () => {
  let chat: string;

  beforeAll(async () => {
    chat = await connect(asha, meera);
  });

  it("can't be written directly", async () => {
    await expect(
      run(asha, "insert into public.messages (connection_id, sender_id, body) values ($1, $2, 'hi')", [chat, asha]),
    ).rejects.toThrow(/permission denied/);
  });

  it("are trimmed, can't be empty or longer than 2000 characters", async () => {
    await expect(run(asha, "select public.send_message($1, '   ')", [chat])).rejects.toThrow(/empty_message/);
    await expect(run(asha, "select public.send_message($1, $2)", [chat, "a".repeat(2001)])).rejects.toThrow(/message_too_long/);
  });

  it("show in both people's chat lists with unread counts", async () => {
    await run(asha, "select public.send_message($1, '  Tea Post at 6?  ')", [chat]);
    await run(asha, "select public.send_message($1, 'I''ll be near Emiet')", [chat]);
    const [mine] = await run<{ display_name: string; last_body: string; last_from_me: boolean; unread: number }>(
      asha,
      "select display_name, last_body, last_from_me, unread from public.my_chats() where connection_id = $1",
      [chat],
    );
    expect(mine).toEqual({ display_name: "Meera", last_body: "I'll be near Emiet", last_from_me: true, unread: 0 });
    const [theirs] = await run<{ unread: number }>(meera, "select unread from public.my_chats() where connection_id = $1", [chat]);
    expect(theirs.unread).toBe(2);
    const badge = await one<{ b: { unread_chats: number } }>(meera, "select public.chat_badge() b");
    expect(badge.b.unread_chats).toBe(1);
    await run(meera, "select public.mark_chat_read($1)", [chat]);
    const [after] = await run<{ unread: number }>(meera, "select unread from public.my_chats() where connection_id = $1", [chat]);
    expect(after.unread).toBe(0);
    const { rows } = await db.query<{ body: string }>("select body from public.messages where connection_id = $1 order by created_at limit 1", [chat]);
    expect(rows[0].body).toBe("Tea Post at 6?");
  });

  it("a retried send with the same id isn't stored twice", async () => {
    const id = crypto.randomUUID();
    await run(meera, "select public.send_message($1, 'On my way', $2)", [chat, id]);
    await run(meera, "select public.send_message($1, 'On my way', $2)", [chat, id]);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.messages where id = $1", [id]);
    expect(rows[0].n).toBe(1);
    // Nobody else can claim that id.
    await expect(run(asha, "select public.send_message($1, 'x', $2)", [chat, id])).rejects.toThrow(/not_allowed/);
  });

  it("are private to the two people", async () => {
    expect(await run(ravi, "select * from public.messages where connection_id = $1", [chat])).toHaveLength(0);
    await expect(run(ravi, "select public.send_message($1, 'hey')", [chat])).rejects.toThrow(/not_found/);
    const { rows } = await db.query<{ id: string }>("select id from public.messages where connection_id = $1 limit 1", [chat]);
    await expect(run(ravi, "select public.file_report('message', $1, 'spam')", [rows[0].id])).rejects.toThrow(/not_found/);
  });

  it("stop when the other person is suspended", async () => {
    await db.query("update public.profiles set status = 'suspended' where id = $1", [meera]);
    await expect(run(asha, "select public.send_message($1, 'hello?')", [chat])).rejects.toThrow(/not_available/);
    expect(await run(asha, "select * from public.my_chats() where connection_id = $1", [chat])).toHaveLength(0);
    await db.query("update public.profiles set status = 'active' where id = $1", [meera]);
  });

  it("are rate limited", async () => {
    await db.query(
      "insert into public.rate_limit_events (profile_id, action) select $1, 'message' from generate_series(1, 60)",
      [asha],
    );
    await expect(run(asha, "select public.send_message($1, 'one more')", [chat])).rejects.toThrow(/rate_limited/);
    await db.query("delete from public.rate_limit_events where profile_id = $1", [asha]);
  });

  it("removing a connection deletes the chat for both", async () => {
    const c = await connect(ravi, kabir);
    await run(ravi, "select public.send_message($1, 'hi')", [c]);
    await run(kabir, "select public.remove_connection($1)", [ravi]);
    expect(await state(ravi, kabir)).toBe("none");
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.messages where connection_id = $1", [c]);
    expect(rows[0].n).toBe(0);
  });
});

describe("blocking", () => {
  let chat: string;

  beforeAll(async () => {
    chat = await connect(ravi, meera);
    await run(ravi, "select public.send_message($1, 'You up for football?')", [chat]);
  });

  it("can't be written directly, and nobody can see who blocked them", async () => {
    await expect(run(ravi, "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [ravi, kabir])).rejects.toThrow(/permission denied/);
    await run(meera, "select public.block_profile($1)", [ravi]);
    expect(await run(ravi, "select * from public.blocks")).toHaveLength(0);
    expect(await run(meera, "select display_name from public.my_blocks()")).toEqual([{ display_name: "Ravi" }]);
  });

  it("hides the chat and stops messages both ways, keeping it for reports", async () => {
    expect(await run(ravi, "select * from public.my_chats() where connection_id = $1", [chat])).toHaveLength(0);
    expect(await run(ravi, "select * from public.messages where connection_id = $1", [chat])).toHaveLength(0);
    await expect(run(ravi, "select public.send_message($1, 'hello?')", [chat])).rejects.toThrow(/not_found/);
    await expect(run(meera, "select public.send_message($1, 'bye')", [chat])).rejects.toThrow(/not_found/);
    expect(await state(ravi, meera)).toBe("unavailable");
    await expect(run(ravi, "select public.send_connection_request($1)", [meera])).rejects.toThrow(/not_found/);
  });

  it("cancels pending requests between them", async () => {
    await run(kabir, "select public.send_connection_request($1)", [asha]);
    await run(asha, "select public.block_profile($1)", [kabir]);
    expect(await run(asha, "select * from public.my_connection_requests()")).toHaveLength(0);
    const { rows } = await db.query<{ status: string }>("select status from public.connection_requests where from_id = $1 and to_id = $2", [kabir, asha]);
    expect(rows[0].status).toBe("cancelled");
  });

  it("unblocking brings the chat back", async () => {
    await run(meera, "select public.unblock_profile($1)", [ravi]);
    expect(await run(ravi, "select * from public.messages where connection_id = $1", [chat])).toHaveLength(1);
    await run(asha, "select public.unblock_profile($1)", [kabir]);
  });

  it("only works within your college", async () => {
    await expect(run(asha, "select public.block_profile($1)", [outsider])).rejects.toThrow(/not_found/);
    await expect(run(asha, "select public.block_profile($1)", [asha])).rejects.toThrow(/not_found/);
  });
});

describe("reports", () => {
  let chat: string;
  let msg: string;
  let eventId: string;

  beforeAll(async () => {
    chat = await connect(kabir, meera);
    await run(meera, "select public.send_message($1, 'Hi Kabir')", [chat]);
    const r = await one<{ m: { id: string } }>(kabir, "select public.send_message($1, 'something nasty') m", [chat]);
    msg = r.m.id;
    const { rows } = await db.query<{ id: string }>(
      `insert into public.events (institution_id, title, category, starts_at, source_type, host_id, created_by)
       select institution_id, 'Late-night jam', 'music', now() + interval '1 day', 'student_hosted', id, id from public.profiles where id = $1
       returning id`,
      [kabir],
    );
    eventId = rows[0].id;
  });

  it("can't be written directly", async () => {
    await expect(
      run(meera, "insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'profile', $2, 'spam')", [meera, kabir]),
    ).rejects.toThrow(/permission denied/);
  });

  it("save the message and the chat before it as evidence", async () => {
    await run(meera, "select public.file_report('message', $1, 'harassment', 'Kept messaging me')", [msg]);
    const { rows } = await db.query<{ subject_id: string; snapshot: { sender_name: string; message: { body: string }; thread: { from_reported: boolean; body: string }[] } }>(
      "select subject_id, snapshot from public.reports where target_id = $1",
      [msg],
    );
    expect(rows[0].subject_id).toBe(kabir);
    expect(rows[0].snapshot.sender_name).toBe("Kabir");
    expect(rows[0].snapshot.message.body).toBe("something nasty");
    expect(rows[0].snapshot.thread.map((t) => [t.from_reported, t.body])).toEqual([
      [false, "Hi Kabir"],
      [true, "something nasty"],
    ]);
  });

  it("can't be filed on your own message, and repeats don't pile up", async () => {
    await expect(run(kabir, "select public.file_report('message', $1, 'spam')", [msg])).rejects.toThrow(/not_found/);
    await run(meera, "select public.file_report('message', $1, 'harassment')", [msg]);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.reports where target_id = $1", [msg]);
    expect(rows[0].n).toBe(1);
  });

  it("reject unknown reasons and types", async () => {
    await expect(run(meera, "select public.file_report('profile', $1, 'boring')", [kabir])).rejects.toThrow(/bad_reason/);
    await expect(run(meera, "select public.file_report('chat', $1, 'spam')", [kabir])).rejects.toThrow(/bad_type/);
  });

  it("are visible only to their reporter and admins", async () => {
    await run(asha, "select public.file_report('event', $1, 'unsafe')", [eventId]);
    expect(await run(asha, "select * from public.reports")).toHaveLength(1);
    expect(await run(kabir, "select * from public.reports")).toHaveLength(0);
    await expect(run(asha, "select * from public.admin_reports()")).rejects.toThrow(/not_allowed/);
    const open = await run<{ subject_name: string; subject_open_reports: number }>(admin, "select subject_name, subject_open_reports from public.admin_reports()");
    expect(open).toHaveLength(2);
    expect(open.every((r) => r.subject_name === "Kabir" && r.subject_open_reports === 2)).toBe(true);
  });

  it("admins can hide a reported event, which closes its reports and is logged", async () => {
    const [r] = await run<{ id: string }>(admin, "select id from public.admin_reports() where target_type = 'event'");
    await expect(run(admin, "select public.admin_resolve_report($1, 'hide_event')", [(await run<{ id: string }>(admin, "select id from public.admin_reports() where target_type = 'message'"))[0].id])).rejects.toThrow(/bad_action/);
    await run(admin, "select public.admin_resolve_report($1, 'hide_event', 'Unsafe venue')", [r.id]);
    const { rows } = await db.query<{ review_status: string }>("select review_status from public.events where id = $1", [eventId]);
    expect(rows[0].review_status).toBe("rejected");
    await expect(run(admin, "select public.admin_resolve_report($1, 'dismiss')", [r.id])).rejects.toThrow(/already_resolved/);
  });

  it("admins can suspend the person, which closes every open report about them", async () => {
    await run(asha, "select public.file_report('profile', $1, 'fake')", [kabir]);
    const [r] = await run<{ id: string }>(admin, "select id from public.admin_reports() where target_type = 'message'");
    await run(admin, "select public.admin_resolve_report($1, 'suspend_user')", [r.id]);
    const { rows } = await db.query<{ status: string }>("select status from public.profiles where id = $1", [kabir]);
    expect(rows[0].status).toBe("suspended");
    expect(await run(admin, "select * from public.admin_reports()")).toHaveLength(0);
    const closed = await run<{ resolution: string }>(admin, "select resolution from public.admin_reports(false)");
    expect(closed.map((c) => c.resolution).sort()).toEqual(["event_hidden", "suspended", "suspended"]);
    const log = await db.query<{ action: string }>("select action from public.moderation_actions where target_id in ($1, $2)", [kabir, eventId]);
    expect(log.rows.map((l) => l.action).sort()).toEqual(["hide_event", "suspend_user"]);
  });

  it("admins can't act on reports from another college", async () => {
    const otherAdmin = await student("admin.z@other.ac.in", "Zed");
    await makeAdmin(db, otherAdmin);
    await run(meera, "select public.file_report('profile', $1, 'spam')", [asha]);
    const [r] = await run<{ id: string }>(admin, "select id from public.admin_reports()");
    expect(await run(otherAdmin, "select * from public.admin_reports()")).toHaveLength(0);
    await expect(run(otherAdmin, "select public.admin_resolve_report($1, 'dismiss')", [r.id])).rejects.toThrow(/not_found/);
    await run(admin, "select public.admin_resolve_report($1, 'dismiss', 'Not a problem')", [r.id]);
  });
});
