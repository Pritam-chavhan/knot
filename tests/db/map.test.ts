import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, signUp } from "./harness";

let db: PGlite;
let asha: string;
let ravi: string;
let meera: string;
let kabir: string;

// Spots on campus (the Academic Block and Duven hostel), in Palaj village
// next to campus, and in Ahmedabad.
const ACAD = [23.21456, 72.68571] as const;
const HOSTEL = [23.21024, 72.6852] as const;
const VILLAGE = [23.206, 72.68] as const;
// About 2 km north of the campus centre, beyond the 1.5 km radius.
const FAR = [23.2292, 72.6866] as const;
const CITY = [23.0225, 72.5714] as const;

const run = <T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) =>
  as(db, who, async () => (await db.query<T>(sql, params)).rows);
const start = (who: string, at: readonly [number, number], opts: { minutes?: number; visibility?: string; precise?: boolean } = {}) =>
  run(who, "select public.start_sharing($1, $2, 15, $3, $4, $5) s", [at[0], at[1], opts.minutes ?? 30, opts.visibility ?? "campus", opts.precise ?? true]);
const people = (who: string) =>
  run<{ display_name: string; lat: number; lng: number; precise: boolean; connected: boolean }>(
    who,
    "select display_name, lat, lng, precise, connected from public.map_people() order by display_name",
  );

async function student(email: string, name: string) {
  const id = await signUp(db, email);
  await db.query("update public.profiles set display_name = $2, onboarded_at = now() where id = $1", [id, name]);
  return id;
}

beforeAll(async () => {
  db = await createDb();
  asha = await student("asha.k@iitgn.ac.in", "Asha");
  ravi = await student("ravi.p@iitgn.ac.in", "Ravi");
  meera = await student("meera.s@iitgn.ac.in", "Meera");
  kabir = await student("kabir.m@iitgn.ac.in", "Kabir");
});

describe("sharing your spot", () => {
  it("only works on campus", async () => {
    await expect(start(asha, CITY)).rejects.toThrow(/off_campus/);
    await expect(start(asha, [ACAD[0], 72.71])).rejects.toThrow(/off_campus/);
    await expect(start(asha, FAR)).rejects.toThrow(/off_campus/);
  });

  it("works anywhere within 1.5 km of the campus centre, even with a blurred location", async () => {
    // Palaj village, about 900 m from the centre, with an approximate (±2 km) reading.
    await run(asha, "select public.start_sharing($1, $2, 2000, 30, 'campus', true)", [VILLAGE[0], VILLAGE[1]]);
    const { rows } = await db.query<{ lat: number }>("select lat from public.location_sessions where profile_id = $1", [asha]);
    expect(rows[0].lat).toBe(VILLAGE[0]);
    await run(asha, "select public.stop_sharing()");
  });

  it("says how far outside the allowed area a refused reading is", async () => {
    // 2 km from the centre: about 500 m beyond the 1.5 km radius.
    await expect(run(asha, "select public.start_sharing($1, $2, 10, 30, 'campus', true)", [FAR[0], FAR[1]])).rejects.toThrow(/off_campus:(4[5-9]\d|5[0-4]\d)\b/);
  });

  it("covers campus land north along the river", async () => {
    await start(asha, [23.219, 72.6895]);
    await run(asha, "select public.stop_sharing()");
  });

  it("only for 15, 30, 60 or 120 minutes, to connections or everyone", async () => {
    await expect(start(asha, ACAD, { minutes: 600 })).rejects.toThrow(/bad_duration/);
    await expect(start(asha, ACAD, { visibility: "world" })).rejects.toThrow(/bad_visibility/);
  });

  it("starts, shows the session to its owner and ends on its own", async () => {
    await start(asha, ACAD, { minutes: 15 });
    const [{ s }] = await run<{ s: { expires_at: string; visibility: string } }>(asha, "select public.my_sharing() s");
    expect(s.visibility).toBe("campus");
    const mins = (new Date(s.expires_at).getTime() - Date.now()) / 60000;
    expect(mins).toBeGreaterThan(14);
    expect(mins).toBeLessThanOrEqual(15.1);
  });
});

describe("seeing others", () => {
  it("needs you to be sharing too", async () => {
    expect(await people(ravi)).toEqual([]);
    await start(ravi, HOSTEL);
    expect((await people(ravi)).map((p) => p.display_name)).toEqual(["Asha"]);
    expect((await people(asha)).map((p) => p.display_name)).toEqual(["Ravi"]);
  });

  it("respects 'connections only'", async () => {
    await start(meera, ACAD, { visibility: "connections" });
    expect((await people(ravi)).map((p) => p.display_name)).toEqual(["Asha"]);
    // Meera still sees people sharing with everyone.
    expect((await people(meera)).map((p) => p.display_name)).toEqual(["Asha", "Ravi"]);
    await run(meera, "select public.send_connection_request($1)", [ravi]);
    await run(ravi, "select public.send_connection_request($1)", [meera]);
    const seen = await people(ravi);
    expect(seen.map((p) => [p.display_name, p.connected])).toEqual([
      ["Asha", false],
      ["Meera", true],
    ]);
  });

  it("rounds rough spots to about 100 metres before they leave the database", async () => {
    await start(kabir, [23.21234567, 72.68567891], { precise: false });
    const k = (await people(asha)).find((p) => p.display_name === "Kabir")!;
    expect(k.precise).toBe(false);
    expect(k.lat).toBe(23.212);
    expect(k.lng).toBe(72.686);
  });

  it("hides people across a block, both ways", async () => {
    await run(asha, "select public.block_profile($1)", [kabir]);
    expect((await people(asha)).map((p) => p.display_name)).not.toContain("Kabir");
    expect((await people(kabir)).map((p) => p.display_name)).not.toContain("Asha");
    await run(asha, "select public.unblock_profile($1)", [kabir]);
  });

  it("hides suspended students", async () => {
    await db.query("update public.profiles set status = 'suspended' where id = $1", [kabir]);
    expect((await people(asha)).map((p) => p.display_name)).not.toContain("Kabir");
    await db.query("update public.profiles set status = 'active' where id = $1", [kabir]);
  });

  it("never shows anything expired, and deletes it", async () => {
    await db.query("update public.location_sessions set expires_at = now() - interval '1 second', started_at = now() - interval '1 hour' where profile_id = $1", [kabir]);
    expect((await people(asha)).map((p) => p.display_name)).not.toContain("Kabir");
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.location_sessions where profile_id = $1", [kabir]);
    expect(rows[0].n).toBe(0);
  });
});

describe("moving and stopping", () => {
  it("one off-campus reading keeps the last spot; three minutes off campus stops sharing", async () => {
    await db.query("update public.location_sessions set updated_at = now() - interval '1 minute' where profile_id = $1", [ravi]);
    const [{ r }] = await run<{ r: { stopped?: string; off_campus?: boolean } }>(ravi, "select public.update_location($1, $2, 10) r", [CITY[0], CITY[1]]);
    expect(r.stopped).toBeUndefined();
    expect(r.off_campus).toBe(true);
    expect((await people(asha)).map((p) => p.display_name)).toContain("Ravi");
    const { rows } = await db.query<{ lat: number }>("select lat from public.location_sessions where profile_id = $1", [ravi]);
    expect(rows[0].lat).toBe(HOSTEL[0]);

    await db.query("update public.location_sessions set off_campus_since = now() - interval '4 minutes' where profile_id = $1", [ravi]);
    const [{ r: r2 }] = await run<{ r: { stopped?: string } }>(ravi, "select public.update_location($1, $2, 10) r", [CITY[0], CITY[1]]);
    expect(r2.stopped).toBe("off_campus");
    expect(await run(ravi, "select * from public.location_sessions")).toHaveLength(0);
    expect((await people(asha)).map((p) => p.display_name)).not.toContain("Ravi");
  });

  it("coming back on campus clears the off-campus timer", async () => {
    await start(ravi, HOSTEL);
    await run(ravi, "select public.update_location($1, $2, 10)", [CITY[0], CITY[1]]);
    await run(ravi, "select public.update_location($1, $2, 10)", [ACAD[0], ACAD[1]]);
    const { rows } = await db.query<{ off: string | null; lat: number }>("select off_campus_since off, lat from public.location_sessions where profile_id = $1", [ravi]);
    expect(rows[0].off).toBeNull();
    expect(rows[0].lat).toBe(ACAD[0]);
    await run(ravi, "select public.stop_sharing()");
  });

  it("moves are limited to one every 10 seconds", async () => {
    await start(ravi, HOSTEL);
    await run(ravi, "select public.update_location($1, $2, 10)", [ACAD[0], ACAD[1]]);
    const { rows } = await db.query<{ lat: number }>("select lat from public.location_sessions where profile_id = $1", [ravi]);
    expect(rows[0].lat).toBe(HOSTEL[0]);
    // Pretend the last move was 11 seconds ago (the trigger would otherwise stamp now()).
    await db.exec("set session_replication_role = replica");
    await db.query("update public.location_sessions set updated_at = now() - interval '11 seconds' where profile_id = $1", [ravi]);
    await db.exec("set session_replication_role = origin");
    await run(ravi, "select public.update_location($1, $2, 10)", [ACAD[0], ACAD[1]]);
    const after = await db.query<{ lat: number }>("select lat from public.location_sessions where profile_id = $1", [ravi]);
    expect(after.rows[0].lat).toBe(ACAD[0]);
  });

  it("stop deletes the spot at once", async () => {
    await run(ravi, "select public.stop_sharing()");
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.location_sessions where profile_id = $1", [ravi]);
    expect(rows[0].n).toBe(0);
  });

  it("nobody can read or write spots directly", async () => {
    expect(await run(asha, "select * from public.location_sessions where profile_id <> $1", [asha])).toHaveLength(0);
    await expect(run(asha, "update public.location_sessions set lat = 23.21 where profile_id = $1", [asha])).rejects.toThrow(/permission denied/);
  });
});

describe("live count", () => {
  it("counts people sharing with everyone, never yourself or connections-only", async () => {
    for (const who of [asha, ravi, kabir]) await run(who, "select public.stop_sharing()");
    const count = async (who: string) => (await run<{ n: number }>(who, "select public.map_live_count() n"))[0].n;
    expect(await count(asha)).toBe(0);
    await start(ravi, HOSTEL, { visibility: "campus" });
    await start(kabir, HOSTEL, { visibility: "connections" });
    expect(await count(asha)).toBe(1);
    // Ravi doesn't count himself.
    expect(await count(ravi)).toBe(0);
    await run(ravi, "select public.stop_sharing()");
    await run(kabir, "select public.stop_sharing()");
    await start(asha, ACAD);
  });
});

describe("waves", () => {
  it("go only to people you can see, once per half hour", async () => {
    await expect(run(asha, "select public.send_wave($1)", [ravi])).rejects.toThrow(/not_found/);
    // Meera shares with connections only, so Asha can't see her or wave.
    await expect(run(asha, "select public.send_wave($1)", [meera])).rejects.toThrow(/not_found/);
    await run(meera, "select public.send_wave($1)", [asha]);
    await expect(run(meera, "select public.send_wave($1)", [asha])).rejects.toThrow(/already_waved/);
    const waves = await run<{ display_name: string; visible: boolean }>(asha, "select display_name, visible from public.my_waves()");
    expect(waves).toEqual([{ display_name: "Meera", visible: false }]);
    expect(await run(meera, "select * from public.my_waves()")).toHaveLength(0);
  });

  it("can't be written directly", async () => {
    await expect(run(asha, "insert into public.waves (from_id, to_id) values ($1, $2)", [asha, meera])).rejects.toThrow(/permission denied/);
  });
});
