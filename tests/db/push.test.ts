import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, signUp } from "./harness";

let db: PGlite;
let asha: string;
let ravi: string;

const run = <T = Record<string, unknown>>(who: string, sql: string, params: unknown[] = []) =>
  as(db, who, async () => (await db.query<T>(sql, params)).rows);
const KEY = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
const save = (who: string, endpoint: string) => run(who, "select public.save_push_subscription($1, $2, 'tBHItJI5svbpez7KI4CCXg')", [endpoint, KEY]);

beforeAll(async () => {
  db = await createDb();
  asha = await signUp(db, "asha.k@iitgn.ac.in");
  ravi = await signUp(db, "ravi.p@iitgn.ac.in");
});

describe("push subscriptions", () => {
  it("are saved for the caller and readable only by them", async () => {
    await save(asha, "https://fcm.googleapis.com/fcm/send/asha-phone");
    expect(await run(asha, "select endpoint from public.push_subscriptions")).toHaveLength(1);
    expect(await run(ravi, "select endpoint from public.push_subscriptions")).toHaveLength(0);
  });

  it("can't be written directly", async () => {
    await expect(
      run(ravi, "insert into public.push_subscriptions (endpoint, profile_id, p256dh, auth) values ('https://x.example/1', $1, $2, 'tBHItJI5svbpez7KI4CCXg')", [ravi, KEY]),
    ).rejects.toThrow(/permission denied/);
  });

  it("only accept https push addresses and well-formed keys", async () => {
    await expect(save(asha, "http://insecure.example/push")).rejects.toThrow(/bad_subscription/);
    await expect(run(asha, "select public.save_push_subscription('https://x.example/2', 'short', 'tBHItJI5svbpez7KI4CCXg')")).rejects.toThrow(/bad_subscription/);
  });

  it("can be re-saved any number of times without hitting the daily limit", async () => {
    for (let i = 0; i < 30; i++) await save(asha, "https://fcm.googleapis.com/fcm/send/asha-phone");
    expect(await run(asha, "select endpoint from public.push_subscriptions")).toHaveLength(1);
  });

  it("move to the new account when a phone signs in as someone else", async () => {
    await save(ravi, "https://fcm.googleapis.com/fcm/send/asha-phone");
    expect(await run(asha, "select endpoint from public.push_subscriptions")).toHaveLength(0);
    expect(await run(ravi, "select endpoint from public.push_subscriptions")).toHaveLength(1);
  });

  it("can be removed only by their owner", async () => {
    await run(asha, "select public.delete_push_subscription('https://fcm.googleapis.com/fcm/send/asha-phone')");
    expect(await run(ravi, "select endpoint from public.push_subscriptions")).toHaveLength(1);
    await run(ravi, "select public.delete_push_subscription('https://fcm.googleapis.com/fcm/send/asha-phone')");
    expect(await run(ravi, "select endpoint from public.push_subscriptions")).toHaveLength(0);
  });

  it("keep at most 10 phones per student", async () => {
    for (let i = 0; i < 12; i++) await save(asha, `https://push.example/${i}`);
    expect(await run(asha, "select endpoint from public.push_subscriptions")).toHaveLength(10);
  });
});

describe("server-only pieces", () => {
  it("signing keys and the sent log are invisible to students", async () => {
    await expect(run(asha, "select * from public.push_keys")).rejects.toThrow(/permission denied/);
    await expect(run(asha, "select * from public.push_sent")).rejects.toThrow(/permission denied/);
    await expect(run(asha, "select public.claim_push('message:x')")).rejects.toThrow(/permission denied/);
  });

  it("each event is notified once", async () => {
    const first = await db.query<{ ok: boolean }>("select public.claim_push('message:123') ok");
    const again = await db.query<{ ok: boolean }>("select public.claim_push('message:123') ok");
    expect(first.rows[0].ok).toBe(true);
    expect(again.rows[0].ok).toBe(false);
  });
});
