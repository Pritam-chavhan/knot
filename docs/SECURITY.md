# Security model

KNOT holds students' names, photos, plans and campus mail, so the rules below are enforced in the database and tested, not left to the interface.

## Accounts

- **Sign-in.** One-time links sent to college email. There are no passwords to leak.
- **Allowed addresses.** Any `iitgn.ac.in` address, or one with up to three well-formed labels in front (`caa.iitgn.ac.in`). Look-alikes such as `eviliitgn.ac.in` or `iitgn.ac.in.example.com` are refused, and the app and the database apply the same rule.
- **Shared mailboxes.** Office and club addresses (dean, office and similar) are blocked, so every account is one person.
- **Suspension.** Takes effect immediately. The account's sessions are ended and its access to data and chats stops.

## What each person can do

| | Students | Admins | Founder |
|---|---|---|---|
| See classmates' names, photos, bios, links | Yes, except people they've blocked or who blocked them | Yes | Yes |
| See email addresses, last-seen times, roles | Only their own | Through the dashboard | Through the dashboard |
| Mark Going or Interested, host plans, request to join | Through database functions with capacity, approval and rate limits | Same | Same |
| Publish, edit, cancel or hide institute and club events | No | Yes, logged | Yes, logged |
| Suspend students or change roles | No | Yes, except other admins | Yes |
| Change the founder | No | No | No |
| Read or change the audit log | No | Read only | Read only |

Admin rights stop at the institution boundary.

## Data protection

- **Row-level security** is on for every table. Policies decide which rows each person sees.
- **Column-level grants** keep classmates from reading private profile fields at all.
- **Database functions** carry every write with rules attached (capacity, approval, admin actions). They lock the row, check the caller and log admin actions in the same transaction.
- **The audit log** is append-only: a trigger refuses edits and deletes, even from the server.
- **Attendance visibility** is off by default. Counts include everyone; names appear only for students who opt in.
- **Blocks** hide people from each other in profiles, feeds, attendee lists, requests and chats, in both directions.

## Photos and links

- **Upload checks.** Uploads are checked by their first bytes, limited in size and pixel count, and processed one at a time.
- **Re-encoding.** Every photo is re-encoded on the server, which removes metadata such as GPS location.
- **Storage.** Photos are kept in a private bucket and served through an auth-checked route that checks access on every view. Removing a photo, blocking or suspending takes effect at once.
- **Links.** GitHub, Instagram and LinkedIn are stored as usernames and always rebuilt as links to the official site, so a profile link can't point anywhere else.

## Campus email feed

See the Privacy and Safety sections of [EMAIL_FEED.md](EMAIL_FEED.md). In short:
- The feed's token is stored only as a SHA-256 fingerprint.
- Non-event mail is never stored.
- Contacts are removed before any mail reaches the AI provider.
- Mail can only publish or change events under strict sender rules.

## Pages

- **Headers.** Every page sends a nonce-based Content Security Policy, HSTS, `X-Frame-Options: DENY`, a strict referrer policy and a permissions policy that allows location only on KNOT itself.
- **Scripts.** No third-party scripts are loaded.
- **Errors.** Error messages shown to students are written by hand; raw database messages never reach the browser.

## How changes are checked

- **Security review.** Each feature had an independent security review before release, and each finding was fixed and covered by a test in `tests/db` or `tests/unit`.
- **CI.** Runs the full test suite and a dependency audit on every push.

To report a security problem, see [../SECURITY.md](../SECURITY.md).
