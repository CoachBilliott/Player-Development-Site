# Proposed prelaunch interest activation

Prepared source only; final validation and rehearsal/recovery checks are required.
The owner approved the bounded list/intake and fixed shared-inbox email scope on
2026-10-28. Approval does not make an untested deployment or unavailable key ready.
Target only existing Supabase project **iilbulpqbuknhdpmtrvm**. Production remains
571667c. Auth SMTP must not be read, extracted or reused.

## Database scope

Review/apply **017-staff-operational-notifications.sql**, then
**018-public-interest-and-shared-inbox.sql**, after approved rehearsal/recovery
readiness. Existing 012/015/016 are dependencies already installed; do not rerun
them or add grouped-media 013/014. Do not activate 017 alone: 018 supersedes its
previous proposed personal/coach recipient routing.

- Private adult-interest data: optional adult name (maximum 60 characters), adult
  contact email (maximum 254), one current package ID or undecided, request UUID,
  server timestamps and adult self-declaration time. No account/profile, child
  information, message, health information or video is created/collected.
- An optional, initially unchecked launch-email choice is recorded separately.
  Private submission events retain the choice, exact notice text/version and
  server timestamp. Legacy rows are not backfilled. Same-reference/payload retries
  do not add events; changed payload at that reference conflicts. A fresh request
  can update the latest choice while retaining affirmative history. Unchecked
  submissions add no permission and do not cancel a past affirmative request;
  withdrawal is handled through the published business contact. Email ownership
  is not verified by this form. No announcement send or marketing activation is
  included. Owners/Managers can view this history; Coaches/customers cannot.
- RLS/revoked raw-table grants deny anon/authenticated direct access to intake,
  settings and outbox. `accept_public_interest` and
  `claim_interest_notification` are service_role-only; normal user JWTs cannot
  call them. Shared prepare/claim/authorize/finish/observer functions are also
  service-only. No private-video permissions, roles, payments or child gates change.
- Checked `interest_staff_inbox` permits existing verified active Owners/Managers
  to read the newest 100 adult interest records/status; Coaches, customers and
  anonymous callers are denied. Staff attempt visibility stays all records for
  Owners/Managers and assigned athlete service records only for Coaches; Coaches
  cannot see interest contacts or global interest jobs.
- Routing is constrained to **Repformed@gmail.com**. Future verified Owner/Manager
  email recipients are not selectable/active. No coach/client/personal routing.
- Atomic abuse budgets: 10 new submissions per 10 minutes globally,3 per normalized
  email per 24 hours; same email/package coalesces for 24 hours. Same UUID/payload is
  idempotent; changed payload at an existing UUID is rejected. Distinct submission
  events consume the abuse budget even when the lead/alert is coalesced. Strict fields,
  4096-byte streaming limit, honeypot and origin checks supplement these budgets.
  These are not CAPTCHA, verified age or proven guardian consent.

## Minimum A: saved interest list, with staff email OFF

After final validation and exact approval, apply the two migrations above and
**deploy only interest-intake**, granting a JWT-verification exemption for that
new public endpoint only. The function uses the existing hosted runtime's built-in
SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY internally; do not retrieve/copy them.
Origins are repformed.com and repformed.pages.dev; origin checks are not auth.

Enable INTEREST_INTAKE_MODE=enabled and interest_intake_settings.enabled, then
publish the matched frontend with interestIntakeEnabled=true. Normal auth stays
on and membersSignupEnabled stays false. Owners/Managers see the checked private
interest inbox; no new role grants. Staff-only email UI is independently gated.
Keep email_enabled=false, STAFF_NOTIFICATION_EMAIL_MODE disabled, automatic
in-app observation off, and no generic worker/cron. **No new application key is
needed for this list-first activation.**

Approval includes the proposed interest privacy notice and a phone canary using
adult name Repformed launch check, contact Repformed@gmail.com, package Not sure
yet, and adult declaration. Repeat the submission/refresh to verify one saved
request, Owner/Manager visibility and Coach/customer denial. The normal visitor
flow is direct form submission, never an email-client step. Check a real saved
record, not a fake success. No applicant email, account, payment or child data.

## Optional B: automatic shared-inbox staff alerts

Approved setup scope: create a Resend Sending-access application key restricted to
verified repformed.com, entered securely only as Edge Function secret
REPFORMED_RESEND_API_KEY in this existing project. Never use chat/source/logs/
browser/local files or Auth SMTP credentials. No purchase or DNS change.

Fixed sender: Repformed <notifications@repformed.com>.
Fixed recipient: Repformed@gmail.com.
The generic alert links staff to authenticated https://repformed.com/#workspace
without applicant name/email, athlete details or media URL. No client
confirmation/marketing email. Saved interest remains usable if staff email fails.

Enable STAFF_NOTIFICATION_EMAIL_MODE=resend and database email_enabled with
routing_mode=shared_inbox; set staffNotificationEmailsEnabled=true only to expose
the checked mail-status panel. Activation records a forward-only cutoff. Do not
backfill list-only submissions. Future Owner/Manager recipient routing stays off.

Each accepted request attempts **only its own leased interest job**, using
EdgeRuntime.waitUntil when available (otherwise a bounded awaited attempt).
No scheduler is required for this first attempt. The generic staff-notifications
endpoint, overdue monitoring, automatic in-app observation and native push are
not needed or activated. The generic dispatcher's JWT/server-token boundary must
remain intact. Automatic retries without a visitor retry/operator invocation
need separately approved scheduling. Stable keys, leases, at most four attempts
and a 23-hour duplicate-protection window remain.

Optional email canary: one new synthetic adult request to the same business
inbox, then duplicate checks. Require actual inbox receipt, not provider
acceptance alone. No historical replay or repeated uncontrolled sends.

## Data notice, recovery and rollback

Review the linked notice: optional adult name/email/package privately stored in
Supabase for follow-up; Owner/Manager access; optional staff-only Resend/Gmail
alerts with no contact details in message bodies; launch-email preference is a
separate optional record, not an activated marketing subscription or send.
Retention/deletion process and final wording need business review. No automatic
purge or legal certification is claimed.

Before applying: approved rehearsal/recovery snapshot and final source checks.
To stop, disable the frontend form flag, INTEREST_INTAKE_MODE and intake/email
DB flags. Preserve accepted requests/outbox for reconciliation; do not drop
requests during rollback. Secondary manual contact is available for outages,
never required to complete a successful form submission. In-flight/accepted
emails cannot be recalled. Re-enabling advances the cutoff: no historical
interest, mailto clicks, Auth registrations or clients are replayed.

No hosted changes, credential creation, real sends or scheduler activation have
been performed by this source work. Final checks, bounded hosted rehearsal and
secure application-key entry remain activation gates. If secure key entry cannot
be performed, list-only activation can be reviewed separately with sending off;
do not claim the requested inbox-delivery canary has then passed.
