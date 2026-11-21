import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, signUp } from "./harness";

let db: PGlite;
let asha: string;
let ravi: string;
let meera: string;
let kabir: string;
let zoya: string;
let half: string;

type Row = { id: string; display_name: string; shared_interests: string[]; mutual_connections: number; state: string; score: number };

const run = <T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) =>
  as(db, who, async () => (await db.query<T>(sql, params)).rows);
const people = (who: string, q: string | null = null) => run<Row>(who, "select * from public.people_directory($1, 30)", [q]);
const names = (rows: Row[]) => rows.map((r) => r.display_name);

async function student(email: string, name: string, programme: string, batch: number, interests: string[]) {
  const id = await signUp(db, email);
  await db.query("update public.profiles set display_name = $2, programme = $3, batch_year = $4, onboarded_at = now() where id = $1", [id, name, programme, batch]);
  for (const i of interests) {
    await db.query("insert into public.interests (name) values ($1) on conflict (name) do nothing", [i]);
    await db.query("insert into public.profile_interests (profile_id, interest_id) select $1, id from public.interests where name = $2", [id, i]);
  }
  return id;
}

async function connect(a: string, b: string) {
  await run(a, "select public.send_connection_request($1)", [b]);
  await run(b, "select public.send_connection_request($1)", [a]);
}

beforeAll(async () => {
  db = await createDb();
  asha = await student("asha.k@iitgn.ac.in", "Asha Kulkarni", "B.Tech CSE", 2027, ["Chess", "Football", "Music"]);
  ravi = await student("ravi.p@iitgn.ac.in", "Ravi Patel", "B.Tech CSE", 2027, ["Chess", "Football"]);
  meera = await student("meera.s@iitgn.ac.in", "Meera Shah", "B.Des", 2026, ["Music"]);
  kabir = await student("kabir.m@iitgn.ac.in", "Kabir Mehta", "M.Tech Civil", 2025, ["Cricket"]);
  zoya = await student("zoya.r@iitgn.ac.in", "Zoya Rao", "B.Tech EE", 2028, ["Photography"]);
  half = await signUp(db, "half.done@iitgn.ac.in");
  await db.query("insert into public.institutions (name, email_domain) values ('Other', 'other.ac.in')");
  await student("x.y@other.ac.in", "Outsider Person", "B.Tech CSE", 2027, ["Chess"]);
});

describe("people you may know", () => {
  it("lists other set-up students at your college, best match first", async () => {
    const rows = await people(asha);
    expect(names(rows)).not.toContain("Asha Kulkarni");
    expect(names(rows)).not.toContain("Outsider Person");
    expect(rows.map((r) => r.id)).not.toContain(half);
    // Ravi shares two interests, programme and batch, so he comes first.
    expect(rows[0].display_name).toBe("Ravi Patel");
    expect(rows[0].shared_interests).toEqual(["Chess", "Football"]);
    expect(rows[0].state).toBe("none");
    expect(names(rows)).toEqual(expect.arrayContaining(["Meera Shah", "Kabir Mehta", "Zoya Rao"]));
  });

  it("counts mutual connections and leaves out people you're already connected with", async () => {
    await connect(asha, meera);
    await connect(ravi, meera);
    const rows = await people(asha);
    expect(names(rows)).not.toContain("Meera Shah");
    expect(rows.find((r) => r.display_name === "Ravi Patel")?.mutual_connections).toBe(1);
  });

  it("puts people who asked to connect with you near the top", async () => {
    await run(zoya, "select public.send_connection_request($1)", [asha]);
    const rows = await people(asha);
    expect(rows.find((r) => r.display_name === "Zoya Rao")?.state).toBe("incoming");
  });

  it("hides blocked people both ways", async () => {
    await run(kabir, "select public.block_profile($1)", [asha]);
    expect(names(await people(asha))).not.toContain("Kabir Mehta");
    expect(names(await people(kabir))).not.toContain("Asha Kulkarni");
    expect(await run<{ n: number }>(asha, "select public.people_count() n")).toEqual([{ n: 3 }]);
  });
});

describe("search", () => {
  it("matches names, programmes, batch years and interests", async () => {
    expect(names(await people(asha, "ravi"))).toEqual(["Ravi Patel"]);
    expect(names(await people(asha, "B.Des"))).toEqual(["Meera Shah"]);
    expect(names(await people(asha, "2028"))).toEqual(["Zoya Rao"]);
    expect(names(await people(asha, "photo"))).toEqual(["Zoya Rao"]);
  });

  it("includes connections and treats the search text literally", async () => {
    expect(await people(asha, "meera")).toEqual([expect.objectContaining({ display_name: "Meera Shah", state: "connected" })]);
    expect(await people(asha, "%")).toEqual([]);
    expect(await people(asha, "_")).toEqual([]);
  });

  it("refuses very long searches and signed-out callers", async () => {
    await expect(people(asha, "x".repeat(61))).rejects.toThrow(/bad_query/);
    await expect(run(half, "select * from public.people_directory(null, 5)")).resolves.toBeDefined();
    await expect(as(db, null, () => db.query("select * from public.people_directory(null, 5)"))).rejects.toThrow();
  });
});
