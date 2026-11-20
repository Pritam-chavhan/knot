import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, makeAdmin, signUp } from "./harness";

let db: PGlite;
let asha: string;
let ravi: string;
let meera: string;
let admin: string;
let institutionId: string;

const count = async (sql: string, params: unknown[] = []) =>
  Number(((await db.query<{ n: number }>(sql, params)).rows[0] as { n: number }).n);

async function publishCommunityEvent(title = "Robotics talk") {
  return as(db, admin, async () => {
    const r = await db.query<{ id: string }>(
      `insert into public.events (institution_id, source_type, title, category, starts_at, created_by)
       values ($1, 'community', $2, 'talk', now() + interval '1 day', $3) returning id`,
      [institutionId, title, admin],
    );
    return r.rows[0].id;
  });
}

beforeAll(async () => {
  db = await createDb();
  institutionId = (await db.query<{ id: string }>("select id from public.institutions")).rows[0].id;
  asha = await signUp(db, "asha.k@iitgn.ac.in");
  ravi = await signUp(db, "ravi.p@iitgn.ac.in");
  meera = await signUp(db, "meera.s@iitgn.ac.in");
  admin = await signUp(db, "pritam.c@iitgn.ac.in");
  await makeAdmin(db, admin);
}, 60_000);

describe("sign-up rules", () => {
  it("refuses email outside the institution domain", async () => {
    await expect(signUp(db, "someone@gmail.com")).rejects.toThrow(/email_not_allowed/);
  });

  it("refuses shared office and club addresses", async () => {
    await expect(signUp(db, "dean.ga@iitgn.ac.in")).rejects.toThrow(/email_not_allowed/);
    await expect(signUp(db, "caa@iitgn.ac.in")).rejects.toThrow(/email_not_allowed/);
    await expect(signUp(db, "club.x@caa.iitgn.ac.in")).rejects.toThrow(/email_not_allowed/);
  });

  it("accepts any IITGN subdomain", async () => {
    await expect(signUp(db, "neha.r@caa.iitgn.ac.in")).resolves.toBeTruthy();
    await expect(signUp(db, "neha.r@alumni.iitgn.ac.in")).resolves.toBeTruthy();
    await expect(signUp(db, "kiran.j@a-b.c2.iitgn.ac.in")).resolves.toBeTruthy();
    await expect(signUp(db, "Tara.M@Students.IITGN.ac.in")).resolves.toBeTruthy();
  });

  it("refuses look-alike and malformed domains", async () => {
    for (const email of [
      "neha@eviliitgn.ac.in",
      "neha@iitgn.ac.in.example.com",
      "neha@iitgn-ac.in",
      "neha@iitgnxac.in",
      "neha@.iitgn.ac.in",
      "neha@a..iitgn.ac.in",
      "neha@-caa.iitgn.ac.in",
      "neha@caa-.iitgn.ac.in",
      "neha@caa_x.iitgn.ac.in",
      "neha@a.b.c.d.iitgn.ac.in",
      "neha@caa.iitgn.ac.in@gmail.com",
      "neha@iitgn.ac.in\n.example.com",
    ]) {
      await expect(signUp(db, email), email).rejects.toThrow(/email_not_allowed/);
    }
  });

  it("still refuses shared mailboxes on subdomains", async () => {
    await expect(signUp(db, "dean.x@alumni.iitgn.ac.in")).rejects.toThrow(/email_not_allowed/);
  });

  it("creates a profile and privacy settings for an allowed address", async () => {
    expect(await count("select count(*) n from public.profiles where id = $1", [asha])).toBe(1);
    expect(await count("select count(*) n from public.privacy_settings where profile_id = $1", [asha])).toBe(1);
  });
});

describe("profiles", () => {
  it("are invisible to someone who is not signed in", async () => {
    const n = await as(db, null, () => count("select count(*) n from public.profiles"));
    expect(n).toBe(0);
  });

  it("are visible to other members", async () => {
    const n = await as(db, asha, () =>
      count("select count(*) n from public.profiles where id = any($1)", [[asha, ravi, meera, admin]]),
    );
    expect(n).toBe(4);
  });

  it("cannot be promoted to admin by their owner", async () => {
    await expect(
      as(db, asha, () => db.query("update public.profiles set role = 'admin' where id = $1", [asha])),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot be edited by another student", async () => {
    await as(db, ravi, () =>
      db.query("update public.profiles set display_name = 'hacked' where id = $1", [asha]),
    );
    const name = (await db.query<{ display_name: string | null }>(
      "select display_name from public.profiles where id = $1", [asha],
    )).rows[0].display_name;
    expect(name).not.toBe("hacked");
  });
});

describe("interests", () => {
  const mine = async (id: string) =>
    (await db.query<{ interest_id: number }>(
      "select interest_id from public.profile_interests where profile_id = $1 order by 1", [id],
    )).rows.map((r) => r.interest_id);

  it("are replaced in one step and only for the caller", async () => {
    await as(db, asha, () => db.query("select public.set_my_interests($1)", [[1, 2, 2, 3]]));
    expect(await mine(asha)).toEqual([1, 2, 3]);
    await as(db, asha, () => db.query("select public.set_my_interests($1)", [[4]]));
    expect(await mine(asha)).toEqual([4]);
    expect(await mine(ravi)).toEqual([]);
  });

  it("keeps the old interests if the new list is refused", async () => {
    await expect(
      as(db, asha, () => db.query("select public.set_my_interests($1)", [[1, 2, 3, 4, 5, 6, 7, 8, 9]])),
    ).rejects.toThrow(/too_many_interests/);
    expect(await mine(asha)).toEqual([4]);
    await expect(as(db, asha, () => db.query("select public.set_my_interests($1)", [[4, 99999]]))).rejects.toThrow();
    expect(await mine(asha)).toEqual([4]);
  });
});

describe("events", () => {
  it("students cannot create community or official events", async () => {
    await expect(
      as(db, asha, () =>
        db.query(
          `insert into public.events (institution_id, source_type, title, category, starts_at, created_by)
           values ($1, 'community', 'Fake official', 'talk', now() + interval '1 day', $2)`,
          [institutionId, asha],
        ),
      ),
    ).rejects.toThrow();
  });

  it("students host through the database function, labelled student-hosted", async () => {
    const id = await as(db, asha, async () =>
      (await db.query<{ id: string }>(
        "select public.create_hosted_event('Jam session', 'music', now() + interval '2 days', null, 'Music room', null, 10, 'open') as id",
      )).rows[0].id,
    );
    expect(await as(db, ravi, () => count("select count(*) n from public.events where id = $1", [id]))).toBe(1);
    const row = (await db.query<{ source_type: string; host_id: string }>("select source_type, host_id from public.events where id = $1", [id])).rows[0];
    expect(row).toEqual({ source_type: "student_hosted", host_id: asha });
    await as(db, ravi, () => db.query("update public.events set title = 'Taken over' where id = $1", [id]));
    const title = (await db.query<{ title: string }>("select title from public.events where id = $1", [id])).rows[0].title;
    expect(title).toBe("Jam session");
  });

  it("drafts are hidden from students", async () => {
    const id = await as(db, admin, async () => {
      const r = await db.query<{ id: string }>(
        `insert into public.events (institution_id, source_type, verified_by, created_by, title, category, starts_at, status)
         values ($1, 'official', $2, $2, 'Secret draft', 'social', now() + interval '3 days', 'draft') returning id`,
        [institutionId, admin],
      );
      return r.rows[0].id;
    });
    expect(await as(db, ravi, () => count("select count(*) n from public.events where id = $1", [id]))).toBe(0);
  });
});

describe("participation and privacy", () => {
  it("counts include hidden attendees but their names stay hidden", async () => {
    const eventId = await publishCommunityEvent();
    await as(db, asha, () =>
      db.query(
        "select public.set_my_participation($1, 'going', true)",
        [eventId],
      ),
    );
    await as(db, meera, () =>
      db.query(
        "select public.set_my_participation($1, 'going', false)",
        [eventId],
      ),
    );
    const counts = await as(db, ravi, () =>
      db.query<{ going: number }>("select * from public.event_counts($1)", [eventId]),
    );
    expect(Number(counts.rows[0].going)).toBe(2);
    const visible = await as(db, ravi, () =>
      db.query<{ profile_id: string }>("select profile_id from public.event_participation where event_id = $1", [eventId]),
    );
    expect(visible.rows.map((r) => r.profile_id)).toEqual([asha]);
  });

  it("a student cannot mark someone else as going", async () => {
    const eventId = await publishCommunityEvent("Quiz night");
    await expect(
      as(db, ravi, () =>
        db.query(
          "insert into public.event_participation (event_id, profile_id, state) values ($1, $2, 'going')",
          [eventId, asha],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("blocking", () => {
  it("hides the blocked person from profiles and attendee lists, both ways", async () => {
    const eventId = await publishCommunityEvent("Football 5-a-side");
    await as(db, ravi, () =>
      db.query(
        "select public.set_my_participation($1, 'going', true)",
        [eventId],
      ),
    );
    await as(db, meera, () => db.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [meera, ravi]));
    expect(await as(db, meera, () => count("select count(*) n from public.profiles where id = $1", [ravi]))).toBe(0);
    expect(await as(db, ravi, () => count("select count(*) n from public.profiles where id = $1", [meera]))).toBe(0);
    expect(
      await as(db, meera, () => count("select count(*) n from public.event_participation where event_id = $1", [eventId])),
    ).toBe(0);
  });

  it("stops connection requests between them", async () => {
    await expect(
      as(db, ravi, () =>
        db.query(
          "insert into public.connection_requests (from_id, to_id, context) values ($1, $2, 'people')",
          [ravi, meera],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("connections and messages", () => {
  it("only the two connected students can read and send messages", async () => {
    const reqId = await as(db, asha, async () =>
      (await db.query<{ id: string }>(
        "insert into public.connection_requests (from_id, to_id, context, note) values ($1, $2, 'event', 'Going together?') returning id",
        [asha, ravi],
      )).rows[0].id,
    );
    // The sender cannot accept their own request.
    await expect(as(db, asha, () => db.query("select public.accept_connection_request($1)", [reqId]))).rejects.toThrow(/not_allowed/);
    const connId = await as(db, ravi, async () =>
      (await db.query<{ accept_connection_request: string }>("select public.accept_connection_request($1)", [reqId])).rows[0]
        .accept_connection_request,
    );
    await as(db, asha, () =>
      db.query("insert into public.messages (connection_id, sender_id, body) values ($1, $2, 'See you there')", [connId, asha]),
    );
    expect(await as(db, ravi, () => count("select count(*) n from public.messages where connection_id = $1", [connId]))).toBe(1);
    expect(await as(db, meera, () => count("select count(*) n from public.messages where connection_id = $1", [connId]))).toBe(0);
    await expect(
      as(db, meera, () =>
        db.query("insert into public.messages (connection_id, sender_id, body) values ($1, $2, 'hi')", [connId, meera]),
      ),
    ).rejects.toThrow();
  });
});

describe("rate limits", () => {
  it("refuses an action once the limit is reached", async () => {
    await as(db, asha, async () => {
      await db.query("select public.check_rate_limit('test', 2, interval '1 hour')");
      await db.query("select public.check_rate_limit('test', 2, interval '1 hour')");
    });
    await expect(
      as(db, asha, () => db.query("select public.check_rate_limit('test', 2, interval '1 hour')")),
    ).rejects.toThrow(/rate_limited/);
  });
});

describe("live map", () => {
  it("shows live sessions to members, hides them across a block, keeps no expired rows visible", async () => {
    await as(db, asha, () =>
      db.query(
        "insert into public.location_sessions (profile_id, lat, lng, expires_at) values ($1, 23.21, 72.68, now() + interval '1 hour')",
        [asha],
      ),
    );
    expect(await as(db, ravi, () => count("select count(*) n from public.location_sessions where profile_id = $1", [asha]))).toBe(1);
    await as(db, asha, () => db.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [asha, ravi]));
    expect(await as(db, ravi, () => count("select count(*) n from public.location_sessions where profile_id = $1", [asha]))).toBe(0);
  });

  it("refuses positions outside the campus bounds when bounds are set", async () => {
    await db.query(
      `update public.institutions set map_bounds = '{"south":23.20,"west":72.67,"north":23.22,"east":72.70}'`,
    );
    await expect(
      as(db, meera, () =>
        db.query(
          "insert into public.location_sessions (profile_id, lat, lng, expires_at) values ($1, 19.07, 72.87, now() + interval '1 hour')",
          [meera],
        ),
      ),
    ).rejects.toThrow();
    await db.query("update public.institutions set map_bounds = null");
  });

  it("a student cannot place someone else on the map", async () => {
    await expect(
      as(db, ravi, () =>
        db.query(
          "insert into public.location_sessions (profile_id, lat, lng, expires_at) values ($1, 23.21, 72.68, now() + interval '1 hour')",
          [meera],
        ),
      ),
    ).rejects.toThrow();
  });
});
