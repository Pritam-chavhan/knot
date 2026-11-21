# Engineering rules

These rules apply to every change in KNOT. CI checks what it can; the rest is checked in review.

## Security and privacy

1. Row-level security is enabled on every table. Access rules live in SQL migrations, not only in application code.
2. Pages and server actions act as the signed-in student (`lib/supabase/server.ts`). The service-role client (`lib/supabase/admin.ts`) is server-only and used only where a student can't act for themselves: the sign-up check, photo storage, account deletion and the email feed.
3. Students never write events, Going or Interested rows, or join requests directly. They go through database functions that enforce capacity, host approval, blocks and rate limits in one transaction.
4. Admin changes go through `admin_*` database functions that check the caller and write the append-only audit log in the same transaction.
5. Classmates can read only public profile fields. A new private column is never added to the column-level grants.
6. Blocks override everything: discovery, profiles, attendee lists, requests, messages and the map.
7. Attendee names are shown only for students who chose to be visible. Counts come from `event_counts()` without exposing rows.
8. Chat only exists inside a mutual connection.
9. Live map: sharing is opt-in per session, campus only, visible only to people sharing too, can be stopped instantly, expires automatically, and keeps no history (one current row per student).
10. Institute and club events are tagged Campus; plans started by students are always tagged Student-hosted.
11. Content from outside (campus mail, AI answers, uploads, links) is untrusted. It is validated field by field before it is stored or shown.
12. Every page sends a nonce-based Content Security Policy and the headers in `lib/security/csp.ts`. Third-party scripts are not allowed. Any new remote origin is added there deliberately, with a test.
13. Secrets live in environment variables. `.env.example` lists names only. Nothing secret is committed.

## Data

- Schema changes only through numbered files in `supabase/migrations/`. Never edit a migration that has already been applied; add a new one.
- Every new table gets row-level security and tests in `tests/db/`. If the service role needs it, grant exactly the access it needs.
- Every query that can grow (feeds, attendee lists, messages, the Inbox) is limited and backed by an index.
- Validate all input on the server with Zod before writing.

## Design and accessibility

- Colours, type and radii come from the tokens in `app/globals.css`. No one-off hex values in components except inside illustrations.
- Headlines use Bricolage Grotesque (`font-display`), body text uses Figtree.
- Text meets WCAG 2.2 AA contrast. White text never sits on marigold, teal (`river`) or rose; use `river-deep` or ink instead.
- Touch targets are at least 44 by 44 pixels. Every control is reachable and visible by keyboard.
- Every screen has a designed loading, empty and error state, written as directions, not apologies.
- Motion answers a user action, is used once per screen at most, and is switched off for people who prefer reduced motion.
- Copy is plain and specific: buttons say what happens ("Email me a sign-in link"), and the same action keeps the same name throughout.

## Performance budgets

- Lighthouse on the landing page, on a phone profile: performance 95 or higher, accessibility 100, best practices 100.
- No layout shift (CLS 0). Largest content visible within 1.5 seconds on a fast connection.
- Fonts are self-hosted. No client-side JavaScript is added to a page unless it needs interaction.

## Definition of done

A feature is done when its user flow, persistence, access rules, validation, loading, empty and error states, and tests all work, it has been checked on a real phone screen size, it passes the accessibility checks, and a security review's findings are fixed. A screen that only looks finished is not done.

## Before pushing

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

CI runs the same steps, plus `npm audit` for high-severity issues in production dependencies.
