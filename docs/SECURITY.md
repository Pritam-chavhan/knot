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
| See other students' names, photos, bios, links | Yes, except people they've blocked or who blocked them | Yes | Yes |
| See email addresses, last-seen times, roles | Only their own | Through the dashboard | Through the dashboard |
| Mark Going or Interested, host plans, request to join | Through database functions with capacity, approval and rate limits | Same | Same |
| Publish, edit, cancel or hide institute and club events | No | Yes, logged | Yes, logged |
| Suspend students or change roles | No | Yes, except other admins | Yes |
| Change the founder | No | No | No |
| Read or change the audit log | No | Read only | Read only |

Admin rights stop at the institution boundary.

## Data protection

- **Row-level security** is on for every table. Policies decide which rows each person sees.
- **Column-level grants** keep other students from reading private profile fields at all.
- **Database functions** carry every write with rules attached (capacity, approval, admin actions). They lock the row, check the caller and log admin actions in the same transaction.
- **The audit log** is append-only: a trigger refuses edits and deletes, even from the server.
- **Attendance visibility** is off by default. Counts include everyone; names appear only for students who opt in.
- **Blocks** hide people from each other in profiles, feeds, attendee lists, requests and chats, in both directions. The blocked person isn't told.

## Connections and chat

- **Sign-up helper** (`/api/signup-help`) accepts only the campus script's private token (stored as a SHA-256 fingerprint). Its database functions run only as the server, never for students. It sends at most two emails per sign-up step, stops once a student joins, and writes nothing but who was emailed and when. For students who never entered a code, the helper's email carries a fresh sign-in code; this is created only for accounts still waiting on their first code (no profile, no data yet), is sent only to that account's own address, and replaces earlier codes. Anyone holding the script token could therefore receive such codes, which is why the token lives only in the founder's IITGN script and only its fingerprint is stored.
- **Sign-up list** (`admin_signups`) is for admins only and limited to their own college. Founder alerts (someone starts signing up, joins, or hosts a plan) go only to phones of accounts marked as founder, once per event.
- **People search** (`people_directory`, `people_count`) runs in the database as the student: it lists only active, onboarded students at the same college, leaves out blocked people both ways, matches search text literally (wildcards are escaped) and caps searches at 60 characters and results at 60.
- **Requests** go only to active students at the same college who accept requests, at most 20 a day. A declined request keeps looking "sent" to the sender for 30 days, so nobody learns they were turned down and nobody can ask again and again.
- **Chats** exist only between two connected students. Only they can read it, including through live updates. Messages are limited to 2,000 characters and 60 per five minutes.
- **Blocking** closes the chat for both people but keeps it, hidden, so it can still be reported. Removing a connection deletes the chat for both.
- **Reports** save what was reported at that moment: the profile, the event, or the message and up to 20 messages before it. Admins see a chat only through a report; they can't browse chats. Acting on a report (suspending someone or hiding an event) closes every open report about the same person or event and is written to the audit log.

## Live map

- **Opt-in, for a set time.** Sharing lasts 15, 30, 60 or 120 minutes and can be stopped at once. Stopping deletes the spot.
- **You see others only while you share.** Nobody can watch the map without being on it.
- **Your choice of audience and precision.** Everyone at IITGN, or connections only; an exact spot, or a rough area rounded to about 100 metres inside the database.
- **On and around campus only.** A position counts if it is within 1.5 km of the campus centre (`institutions.map_bounds.radius_m`), which covers all of IITGN with room for phones that share an approximate, blurred location. Outside that, the campus outline (`map_bounds.polygon`) still applies, and a reading within its own stated accuracy of the edge (at least 50 m, never more than 200 m) is pinned to the edge. Anything else is refused with how far away it was, and the app explains how to turn on precise location. Sharing stops if readings stay away for 3 minutes. A college with no area set can't share at all. Discover shows only a count of people sharing with everyone (`map_live_count`), never who or where.
- **No history.** One current row per student, overwritten as they move (at most once every 10 seconds) and deleted when sharing ends or expires.
- **Blocks and suspensions** hide people from each other on the map, both ways. Waves go only to people you can see, once per half hour, and are deleted after a day.
- **Map tiles** come from OpenStreetMap. They show which part of campus a viewer is looking at, never where anyone is.

## Notifications

- **Opt-in per phone.** A phone's push subscription is saved only when the student turns notifications on, at most 10 phones each, and removed when they turn them off or the browser drops it.
- **Nothing private on a lock screen.** Notifications say who and what kind (a message, a request, a wave), never message text.
- **The database picks the recipient.** Who gets notified always comes from the message, request or wave in the database, checked as the sender; a tap can't aim a notification at anyone else. Each event notifies once.
- **Signing keys** are created by the server on first use and stored where only the server can read them.

## Photos and links

- **Upload checks.** Uploads are checked by their first bytes, limited in size and pixel count, and processed one at a time.
- **Re-encoding.** Every photo is re-encoded on the server, which removes metadata such as GPS location.
- **Storage.** Photos are kept in a private bucket and served through a route that checks the viewer can see that profile. Phones reuse a photo for up to 30 minutes before checking again. A new photo has a new address, so it shows at once; a block or suspension already hides the person everywhere, and their cached photo expires within 30 minutes.
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

- **Security review.** Each feature is reviewed against these rules before release, and each rule is covered by a test in `tests/db` or `tests/unit`.
- **CI.** Runs the full test suite and a dependency audit on every push.

To report a security problem, see [../SECURITY.md](../SECURITY.md).
