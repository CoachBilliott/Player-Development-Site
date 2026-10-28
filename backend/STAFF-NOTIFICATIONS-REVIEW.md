> Current business scope is updated in [INTEREST-ACTIVATION-REVIEW.md](INTEREST-ACTIVATION-REVIEW.md). Draft018 supersedes personal/coach email routing and the undefined-signup gate below. Do not activate draft017 alone. Earlier validation below describes the previous checkpoint, not final intake readiness.

# Staff operational notifications — unpublished source review

Current direction: client training/review updates stay **in-app only**. Required
Auth sign-in/recovery emails are unchanged. This code never reads Auth SMTP
credentials and implements no routine client content-ready emails.

## Implemented source

- Draft 017 reuses 012/015/016 assignments, availability, deadlines, grace periods,
  package/client/athlete states and roster boundaries. It does not require or
  install grouped-media 013/014 or widen private video access.
- A private outbox records one initial overdue-training/review event per required
  item and selected staff recipient. No recurring reminder is generated. Reviews
  must actually be queued/in review with complete, matching private media;
  unsubmitted/incomplete uploads do not become staff-delivery failures.
- Only preselected, verified active staff qualify. Assigned-coach routing uses
  current assignments with selected Owner/Manager fallback. Client accounts and
  arbitrary email addresses cannot self-enroll. Selected staff can pause/resume
  their own participation; current role, email, scope and account closure are
  rechecked when claiming and immediately before transport.
- Jobs freeze recipient/payload identity, use stable Resend idempotency keys,
  short leases and at most four attempts. Transient retries wait at least 60s;
  attempts stop within 23 hours, before Resend's documented 24-hour key expiry.
  Uncertain/expired/conflicting outcomes require reconciliation, not blind resend.
- Provider acceptance is labelled separately from inbox delivery. No webhook,
  bounce/delivery tracking or actual delivery confirmation is implemented.
  Failure/status projections are scoped to Owners/Managers or the assigned coach;
  raw tables and dispatch RPCs remain inaccessible to browser users.
- An independently disabled in-app observer creates forward-only notices for
  exact approved/published assigned content with complete media, or completed
  single-clip feedback. Drafts, future notice boundaries, wrong versions,
  unassigned content, paused/cancelled service and unauthorized households do not
  qualify. Existing read/unread inbox behavior is reused. Notices appear on the
  next inbox load/Refresh; this is not native push or a real-time subscription.

## Signup remains an explicit decision gate

No signup producer exists, and `signup_source` is constrained to NULL. This is
not a ready feature waiting for a hidden switch. Define which event counts first:
verified customer account registration, accepted customer invitation, an actual
interest submission, or paid enrollment. These are different records/timings.
The website currently has mailto interest, not a stored interest submission;
registration and payments remain closed. No click is fabricated into a signup.
After the decision, add/review the matching producer, identity model and one-event
ledger. Do not treat a client signup as creating an athlete profile automatically.

## Tests completed at this checkpoint

- **36 focused unit/database/worker cases passed**: 26 policy cases (including
  compatibility cases with draft 017) and 10 pure worker/transport cases.
- Lint, TypeScript and Deno worker checks passed. The republished-content fixture
  now correctly requires a fresh expectation for the exact approved version.
- Revoked roles/emails, changed destinations, assignment changes, resolved
  delivery, staff opt-out/fallback, grace periods, attempt/window limits, partial
  media, unconfigured signup, stale leases, malformed jobs, duplicate events,
  household isolation and mocked provider failures are covered.
- Aggregate CI at source `0923759` passed: **339 unit/database/worker cases,
  260 browser cases, 8 app/offline cases and 11 Python cases**, plus lint,
  TypeScript, both Deno entry points and production build. Receipt:
  https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40624883189
- The follow-up local UI pass passed **14 desktop/phone cases** (10 new staff
  email panel cases plus 4 existing delivery/inbox cases). It checks status
  distinctions, Owner/Manager results, assigned-Coach responses, refresh after
  assignment removal, double-click locking, opt-out persistence, unavailable
  status clearing stale jobs, failed preference saves, parent exclusion and
  private read/unread inbox persistence. These mock SDK responses; real SQL
  authorization is covered separately by the policy cases above. Mock filtering
  is not evidence of hosted authorization or delivery.
- Screenshots from that local synthetic pass are generated under
  `artifacts/staff-notifications/status-{desktop,phone}.png`. They are review
  artifacts, not a public deployment or actual staff/client records.
- All SQL rehearsals use isolated PGlite synthetic adults; provider transports are
  mocked. No hosted migration, credentials, real email, scheduler or native
  release ran. Latest follow-up aggregate status is attached to draft PR8;
  don't substitute the earlier aggregate result for a later source revision.

## Minimum decisions and approvals before activation

1. Define the signup event and choose exact verified staff recipient IDs and
   training/review routing. No real recipients have been selected by this task.
2. Review/approve migration 017's private tables and new checked staff-read/opt-out
   RPCs plus service-role-only observe/prepare/claim/authorize/finish functions.
   Rehearse in an approved isolated hosted environment and arrange recovery.
   Release the matched website source with `staffNotificationEmailsEnabled` only
   after those RPCs are installed; the UI flag currently defaults off. This does
   not enable transport or give browser users dispatch authority.
3. Approve a **separate Resend Sending-access key restricted to repformed.com**,
   stored only in the Supabase server secret `REPFORMED_RESEND_API_KEY`. Never
   extract/reuse Auth SMTP credentials or put a key in chat, repo or browser.
4. Approve worker deployment with gateway JWT verification retained. It uses the
   hosted runtime's built-in service-role credential for server-only invocation;
   normal member/Owner JWTs cannot invoke mail dispatch. Email mode defaults to
   disabled; `STAFF_NOTIFICATION_EMAIL_MODE=resend` is a separate explicit gate.
5. Approve a named bounded invocation schedule (or a one-off operator canary),
   its credential storage and exact staff-only test recipient before any real
   send. No cron has been configured. In-app observation and staff email have
   separate default-off database flags and forward-only activation cutoffs.
6. Verify the hosted role/access behavior and one approved staff inbox receipt.
   Account SMTP delivery already verified elsewhere does not prove this worker.

Turning sending off stops new attempts. Re-enabling advances the activation
cutoff; old queued/overdue records are not backfilled. A fresh required item is
needed for a new alert; there is no auto-resend just because a deadline is edited.
Current review deadlines remain unchanged; future package business-day terms,
grouped review support, retention and billing need their own review.

Homepage PR7/head 8dacc84 is separate. This branch is based on production 0a8e1eb
and must be integrated/tested with later approved main changes before release.
