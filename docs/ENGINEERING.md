# Engineering rules

These rules come from the KNOT product requirements and apply to every change.

## Security and privacy

1. Row-level security is enabled on every table. Access rules live in SQL migrations, not only in application code.
2. Pages and server actions use the signed-in student's session (`lib/supabase/server.ts`). The privileged client (`lib/supabase/admin.ts`) is server-only and used only for sign-up checks and account deletion.
3. Secrets live in environment variables. `.env.example` lists names only. Nothing secret is committed.
4. Blocks override everything: discovery, attendee lists, requests, messages and the map.
5. Chat only exists inside a mutual connection.
6. Event participation names are shown only when the student chose to be visible. Counts are returned by `event_counts()` without exposing rows.
7. Live map: sharing is opt-in per session, can be stopped instantly, expires automatically, and keeps no history (one current row per student).
8. Official events must be verified. Community events are labelled as coming from a campus announcement. Student-hosted events are always labelled as such.

## Data

- Schema changes only through numbered files in `supabase/migrations/`.
- Every new table gets row-level security and tests in `tests/db/`.
- Validate all input on the server with Zod before writing.

## Definition of done

A feature is done when its user flow, persistence, access rules, validation, error and empty states, and tests all work. A screen that only looks finished is not done.

## Before pushing

```bash
npm run lint && npm run typecheck && npm test
```
