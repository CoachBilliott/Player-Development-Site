# Unpublished staff-only operational notification preparation

Current direction: client training/review updates stay in-app. Required Auth
emails are unchanged. No routine client content-ready mail is implemented.

Draft 017 and the server-only staff-notifications worker prepare one initial
operational alert per overdue training/review item and selected staff recipient,
with role/assignment rechecks, opt-out, bounded retries and a 23-hour retry window.
All new switches default off, recipient selection starts empty, and no cron or
production migration has run. Existing grouped-review source is untouched.

New-signup alerts are deliberately unconfigured: account registration, accepted
invitation, mailto interest and paid enrollment are different events. Public
registration/checkout remain closed; mailto interest is not a stored signup.
Exact recipient IDs and signup meaning need the owner's decision. Activation
needs separate approval for migration/worker permissions, a separate restricted
Resend application key in server secrets and any scheduler. Auth SMTP secrets
must never be extracted or reused.

WIP checkpoint: lint and TypeScript passed. First focused run: 26/27 tests passed;
one new content-version fixture needs correction/verification. No browser or
Deno validation, draft PR, deployment, external email or native release is claimed.
This work is being paused for the owner's homepage priority.
