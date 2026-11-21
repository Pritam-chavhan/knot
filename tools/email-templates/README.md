# Sign-in email

KNOT's branded sign-in email, for Supabase → Authentication → Emails → Templates. Templates can be edited once custom SMTP is switched on.

Use `sign-in.html` as the body of both **Magic link or OTP** and **Confirm sign up** (new students get the second one).

| Template | Subject |
|---|---|
| Magic link or OTP | `{{ .Token }} is your KNOT sign-in code` |
| Confirm sign up | `{{ .Token }} is your KNOT sign-in code` |

In SMTP settings, set **Sender name** to `KNOT` so inboxes show "KNOT" as the sender.

The code comes first because on iPhone a link opens in Safari, not in KNOT on the Home Screen, while the code can be typed straight in. The link goes to `/auth/callback` with a `token_hash`, which works even when it opens in a different browser from the one that asked for it.
