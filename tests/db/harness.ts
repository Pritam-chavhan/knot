import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Minimal stand-in for the parts of Supabase the migrations rely on:
// an auth schema, auth.uid() read from the request claims, and the
// "authenticated" role that row-level security policies target.
const SUPABASE_STUB = `
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
`;

const root = join(__dirname, "..", "..", "supabase");

export async function createDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(root, "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
  return db;
}

// Creates an auth user (which runs the sign-up trigger) and returns its id.
export async function signUp(db: PGlite, email: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  return id;
}

// Runs fn as a signed-in student, inside a transaction that is rolled back
// only on error, so each call sees committed data from earlier calls.
export async function as<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await db.exec("set local role authenticated");
    const result = await fn();
    await db.exec("commit");
    return result;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}

export async function makeAdmin(db: PGlite, userId: string) {
  await db.query("update public.profiles set role = 'admin' where id = $1", [userId]);
}
