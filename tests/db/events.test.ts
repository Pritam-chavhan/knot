import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, makeAdmin, signUp } from "./harness";

let db: PGlite;
let host: string;
let a: string;
let b: string;
let c: string;
let admin: string;
let institutionId: string;

type FeedRow = { id: string; title: string; going: string; interested: string; my_state: string | null; going_names: string[]; status: string };

async function finishProfile(id: string, name: string) {
  await db.query("update public.profiles set display_name = $2, onboarded_at = now() where id = $1", [id, name]);
}

async function hostPlan(opts: { title?: string; capacity?: number | null; joinMode?: "open" | "request" } = {}) {
  // The test host makes many plans; reset their daily limit (the limit has its own test).
  await db.query("delete from public.rate_limit_events where profile_id = $1", [host]);
  return as(db, host, async () => {
    const r = await db.query<{ id: string }>(
      `select public.create_hosted_event($1, 'sports', now() + interval '1 day', null, 'Sports complex', null, $2, $3) as id`,
      [opts.title ?? "Badminton doubles", opts.capacity ?? null, opts.joinMode ?? "open"],
    );
    return r.rows[0].id;
  });
}

async function officialEvent(title = "Amalthea talk") {
  return as(db, admin, async () => {
    const r = await db.query<{ id: string }>(
      `insert into public.events (institution_id, source_type, verified_by, created_by, title, category, starts_at)
       values ($1, 'official', $2, $2, $3, 'talk', now() + interval '2 days') returning id`,
      [institutionId, admin, title],
    );
    return r.rows[0].id;
  });
}

const feed = (who: string) => as(db, who, async () => (await db.query<FeedRow>("select * from public.event_feed()")).rows);
const setState = (who: string, id: string, state: string | null, visible: boolean | null = null) =>
  as(db, who, () => db.query("select public.set_my_participation($1, $2, $3)", [id, state, visible]));

beforeAll(async () => {
  db = await createDb();
  institutionId = (await db.query<{ id: string }>("select id from public.institutions limit 1")).rows[0].id;
  host = await signUp(db, "rohan.v@iitgn.ac.in");
  a = await signUp(db, "ananya.s@iitgn.ac.in");
  b = await signUp(db, "kabir.n@iitgn.ac.in");
  c = await signUp(db, "meera.p@iitgn.ac.in");
  admin = await signUp(db, "pritam.c@caa.iitgn.ac.in");
  await makeAdmin(db, admin);
  for (const [id, n] of [[host, "Rohan"], [a, "Ananya"], [b, "Kabir"], [c, "Meera"], [admin, "Pritam"]]) await finishProfile(id, n);
});

describe("event feed", () => {
  it("lists upcoming events with counts, my state and visible names only", async () => {
    const id = await officialEvent();
    await setState(a, id, "going", true);
    await setState(b, id, "going", false);
    await setState(c, id, "interested");
    const row = (await feed(c)).find((r) => r.id === id)!;
    expect(Number(row.going)).toBe(2);
    expect(Number(row.interested)).toBe(1);
    expect(row.my_state).toBe("interested");
    expect(row.going_names).toEqual(["Ananya"]);
  });

  it("is empty for someone who is not signed in", async () => {
    expect(await as(db, null, async () => (await db.query("select * from public.event_feed()")).rows.length)).toBe(0);
  });

  it("hides a blocked host's plans and blocked people's names", async () => {
    const id = await hostPlan({ title: "Late night chai" });
    await as(db, c, () => db.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [c, host]));
    expect((await feed(c)).some((r) => r.id === id)).toBe(false);
    expect((await feed(a)).some((r) => r.id === id)).toBe(true);
    await expect(setState(c, id, "going")).rejects.toThrow(/not_found/);
    await db.query("delete from public.blocks where blocker_id = $1", [c]);
  });
});

describe("going to a hosted plan", () => {
  it("fills up, refuses the next person, and reopens when someone drops out", async () => {
    const id = await hostPlan({ capacity: 3 });
    await setState(a, id, "going");
    await setState(b, id, "going");
    expect((await feed(c)).find((r) => r.id === id)!.status).toBe("full");
    await expect(setState(c, id, "going")).rejects.toThrow(/event_full/);
    // Interested is still fine on a full plan.
    await setState(c, id, "interested");
    await setState(b, id, null);
    expect((await feed(c)).find((r) => r.id === id)!.status).toBe("published");
    await setState(c, id, "going");
  });

  it("the host can't drop out of their own plan", async () => {
    const id = await hostPlan();
    await expect(setState(host, id, null)).rejects.toThrow(/host_must_go/);
    await expect(setState(host, id, "interested")).rejects.toThrow(/host_must_go/);
  });

  it("students can no longer write going rows directly", async () => {
    const id = await hostPlan({ capacity: 2 });
    await expect(
      as(db, b, () =>
        db.query("insert into public.event_participation (event_id, profile_id, state) values ($1, $2, 'going')", [id, b]),
      ),
    ).rejects.toThrow();
  });

  it("changing visibility keeps you going", async () => {
    const id = await officialEvent("Blithchron open mic");
    await setState(a, id, "going", true);
    await setState(a, id, "going", false);
    const names = (await feed(b)).find((r) => r.id === id)!.going_names;
    expect(names).toEqual([]);
  });
});

describe("plans that need the host's OK", () => {
  it("needs a request; the host lets people in until it's full", async () => {
    const id = await hostPlan({ joinMode: "request", capacity: 2 });
    await expect(setState(a, id, "going")).rejects.toThrow(/request_required/);

    const ra = await as(db, a, async () =>
      (await db.query<{ request_to_join: string }>("select public.request_to_join($1, 'Can I join?')", [id])).rows[0].request_to_join,
    );
    const rb = await as(db, b, async () =>
      (await db.query<{ request_to_join: string }>("select public.request_to_join($1)", [id])).rows[0].request_to_join,
    );

    // Only the host can respond.
    await expect(as(db, b, () => db.query("select public.respond_join_request($1, true)", [ra]))).rejects.toThrow(/not_allowed/);

    await as(db, host, () => db.query("select public.respond_join_request($1, true)", [ra]));
    const row = (await feed(a)).find((r) => r.id === id)!;
    expect(row.my_state).toBe("going");
    expect(row.status).toBe("full");

    await expect(as(db, host, () => db.query("select public.respond_join_request($1, true)", [rb]))).rejects.toThrow(/event_full/);
    await as(db, host, () => db.query("select public.respond_join_request($1, false)", [rb]));
    const status = (await db.query<{ status: string }>("select status from public.event_join_requests where id = $1", [rb])).rows[0].status;
    expect(status).toBe("declined");
  });

  it("a declined request can't be re-sent to spam the host", async () => {
    const id = await hostPlan({ joinMode: "request" });
    const r1 = await as(db, a, async () =>
      (await db.query<{ request_to_join: string }>("select public.request_to_join($1)", [id])).rows[0].request_to_join,
    );
    await as(db, host, () => db.query("select public.respond_join_request($1, false)", [r1]));
    await as(db, a, () => db.query("select public.request_to_join($1)", [id]));
    const status = (await db.query<{ status: string }>("select status from public.event_join_requests where id = $1", [r1])).rows[0].status;
    expect(status).toBe("declined");
  });

  it("students can't insert requests or accept them directly", async () => {
    const id = await hostPlan({ joinMode: "request" });
    await expect(
      as(db, b, () => db.query("insert into public.event_join_requests (event_id, profile_id) values ($1, $2)", [id, b])),
    ).rejects.toThrow();
  });
});

describe("security review fixes", () => {
  it("hosts can't edit or insert event rows directly", async () => {
    const id = await hostPlan({ title: "Chai run" });
    await as(db, host, () =>
      db.query("update public.events set registration_url = 'https://phish.example', review_status = 'approved', capacity = 99 where id = $1", [id]),
    );
    const row = (await db.query<{ registration_url: string | null; capacity: number | null }>("select registration_url, capacity from public.events where id = $1", [id])).rows[0];
    expect(row.registration_url).toBeNull();
    expect(row.capacity).toBeNull();
    await expect(
      as(db, host, () =>
        db.query(
          `insert into public.events (institution_id, source_type, host_id, created_by, title, category, starts_at)
           values ($1, 'student_hosted', $2, $2, 'Sneaky', 'social', now() + interval '1 day')`,
          [institutionId, host],
        ),
      ),
    ).rejects.toThrow();
  });

  it("hosting is limited to 5 plans a day", async () => {
    const fresh = await signUp(db, "spammy.s@iitgn.ac.in");
    await finishProfile(fresh, "Spammy");
    const make = () =>
      as(db, fresh, () => db.query("select public.create_hosted_event('Plan', 'social', now() + interval '1 day', null, 'Mess', null, null, 'open')"));
    for (let i = 0; i < 5; i++) await make();
    await expect(make()).rejects.toThrow(/rate_limited/);
  });

  it("refuses bad plans at the database too", async () => {
    await expect(
      as(db, host, () => db.query("select public.create_hosted_event('Plan', 'social', now() - interval '1 day', null, 'Mess', null, null, 'open')")),
    ).rejects.toThrow(/bad_time/);
    await expect(
      as(db, host, () => db.query("select public.create_hosted_event('Plan', 'social', now() + interval '1 day', null, 'Mess', null, 1, 'open')")),
    ).rejects.toThrow(/bad_capacity/);
  });

  it("only the host can cancel, and everyone sees it cancelled", async () => {
    const id = await hostPlan({ title: "Movie night" });
    await expect(as(db, a, () => db.query("select public.cancel_my_event($1)", [id]))).rejects.toThrow(/not_allowed/);
    await as(db, host, () => db.query("select public.cancel_my_event($1)", [id]));
    expect((await feed(a)).find((r) => r.id === id)!.status).toBe("cancelled");
  });

  it("a declined requester can't undo the host's answer", async () => {
    const id = await hostPlan({ joinMode: "request" });
    const rid = await as(db, b, async () =>
      (await db.query<{ request_to_join: string }>("select public.request_to_join($1)", [id])).rows[0].request_to_join,
    );
    await as(db, host, () => db.query("select public.respond_join_request($1, false)", [rid]));
    await as(db, b, () => db.query("select public.withdraw_join_request($1)", [id]));
    await expect(as(db, b, () => db.query("update public.event_join_requests set status = 'withdrawn' where id = $1", [rid]))).rejects.toThrow();
    await as(db, b, () => db.query("select public.request_to_join($1)", [id]));
    const status = (await db.query<{ status: string }>("select status from public.event_join_requests where id = $1", [rid])).rows[0].status;
    expect(status).toBe("declined");
  });

  it("nobody can check whether two other people blocked each other", async () => {
    await as(db, b, () => db.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [b, c]));
    const r = await as(db, a, async () => (await db.query<{ x: boolean }>("select public.is_blocked_between($1, $2) as x", [b, c])).rows[0].x);
    expect(r).toBe(false);
    await db.query("delete from public.blocks where blocker_id = $1", [b]);
  });

  it("names stay hidden unless a student chooses to show them", async () => {
    const fresh = await signUp(db, "quiet.q@iitgn.ac.in");
    await finishProfile(fresh, "Quiet");
    const id = await officialEvent("Robotics demo");
    await setState(fresh, id, "going");
    expect((await feed(a)).find((r) => r.id === id)!.going_names).toEqual([]);
  });

  it("counts aren't available for drafts", async () => {
    const id = await as(db, admin, async () =>
      (await db.query<{ id: string }>(
        `insert into public.events (institution_id, source_type, verified_by, created_by, title, category, starts_at, status)
         values ($1, 'official', $2, $2, 'Draft talk', 'talk', now() + interval '2 days', 'draft') returning id`,
        [institutionId, admin],
      )).rows[0].id,
    );
    const r = await as(db, a, async () => (await db.query<{ going: string }>("select * from public.event_counts($1)", [id])).rows[0]);
    expect(Number(r.going)).toBe(0);
    await expect(setState(a, id, "going")).rejects.toThrow(/not_found/);
  });
});
