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

9. Every page sends a nonce-based Content Security Policy and the headers in `lib/security/csp.ts`. Third-party scripts are not allowed. Any new remote origin (map tiles, image hosts) is added there deliberately, with a test.

## Data

- Schema changes only through numbered files in `supabase/migrations/`. Never edit a migration that has already been applied; add a new one.
- Every new table gets row-level security and tests in `tests/db/`.
- Every query that can grow (feeds, attendee lists, messages) is paginated and backed by an index.
- Validate all input on the server with Zod before writing.

## Design and accessibility

- Colours, type and radii come from the tokens in `app/globals.css`. No one-off hex values in components except inside illustrations.
- Headlines use Bricolage Grotesque (`font-display`), body text uses Figtree.
- Text meets WCAG 2.2 AA contrast. White text never sits on marigold, teal (`river`) or rose; use `river-deep` or ink instead.
- Touch targets are at least 44 by 44 pixels. Every control is reachable and visible by keyboard.
- Every screen has a designed loading, empty and error state, written as directions, not apologies.
- Motion is used once per screen at most, answers a user action, and is switched off for people who prefer reduced motion.
- Copy is plain and specific: buttons say what happens ("Email me a sign-in link"), and the same action keeps the same name throughout.

## Performance budgets

- Lighthouse on the landing page, on a phone profile: performance 95 or higher, accessibility 100, best practices 100.
- No layout shift (CLS 0). Largest content visible within 1.5 seconds on a fast connection.
- Fonts are self-hosted. No client-side JavaScript is added to a page unless it needs interaction.

## Definition of done

A feature is done when its user flow, persistence, access rules, validation, loading, empty and error states, and tests all work, it has been checked on a real phone screen size, and it passes the accessibility checks. A screen that only looks finished is not done.

## Before pushing

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

CI runs the same steps, plus `npm audit` for high-severity issues in production dependencies.
