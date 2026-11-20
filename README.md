# KNOT

**Know what's on. Meet who's going.**

KNOT is a campus discovery and connection app for IIT Gandhinagar students. It brings campus events into one feed, shows how many people are going, helps students find company, lets anyone host their own activities, and includes an opt-in live campus map.

An independent student project, not affiliated with IIT Gandhinagar.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS, deployed on Vercel
- Supabase: Postgres with row-level security, email-code sign-in, Realtime, Storage
- Vitest for unit and database security-rule tests

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev
```

Database changes live in `supabase/migrations/` and are the only way the schema changes. Reference data is in `supabase/seed.sql`.

## Checks

```bash
npm run lint
npm run typecheck
npm test          # unit tests + database security-rule tests (in-process Postgres)
```

See `docs/ENGINEERING.md` for the build rules this project follows.
