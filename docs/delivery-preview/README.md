# Delivery rules and content inbox — unpublished review

This extends the client-service dashboard on `pilot/core-journey-readiness`.
**No production migration, automatic monitoring, sender, device push or real
customer notification has been enabled.** The public dashboard preview is a
separate fictional build and does not include this extension yet.

## Screen previews

| Screen | Desktop | Phone |
| --- | --- | --- |
| Staff rules and overdue queue | [Open](settings-desktop.png) | [Open](settings-phone.png) |
| Client private inbox | [Open](inbox-desktop.png) | [Open](inbox-phone.png) |

Screens use local fictional adult fixtures. Phone screens are browser emulation.
The image crops hide fixed app navigation so the content panels remain readable;
normal app navigation is separately exercised by the browser tests.

## Implemented in source

- Owner-configured package delivery defaults, client overrides shared by siblings,
  then athlete overrides. Rules include day/time/IANA zone, grace, staff routing,
  escalation delay and content notification preferences. Package names are draft
  labels, not final paid offerings or payment entitlements.
- Independent client/athlete monitoring pause or cancellation, plus cancellation
  of an individual expectation. These change monitoring, not billing or training
  permissions. Existing expectation deadlines preserve their rule snapshot;
  changed defaults apply to new expectations.
- Expected workout and resource versions, due instant and notice boundary. Planning
  a check does **not** assign, upload, hide or schedule the release of training.
  Ambiguous/skipped daylight-saving times are rejected at both UI and database.
- Staff manually check an athlete. The database requires the expected athlete's
  exact eligible assignment, approved version and complete private media receipt.
  An upload alone, sibling assignment or unapproved/partial content is not delivery.
- A staff-only queue with acknowledgement, resolution and deduplicated escalation
  state. Acknowledgement does not mark training delivered. Reopened episodes are
  counted; repeated checks do not duplicate an alert or client content notice.
- Private client in-app notices for available training and delivered feedback,
  with read/unread state. Future notice boundaries suppress early notices. Existing
  content becoming inaccessible is shown honestly rather than leaving a working
  content promise. First **observed** availability is not the historical instant
  content first became available. No open/completion telemetry is invented.
- Only a verified adult account holder receives notices. Minor profiles additionally
  require the existing parent/guardian authorization gates. Linked child email
  addresses are never recipients. No real junior enrollment is opened.

## Prepared or simulated

- Draft configuration, policy checks and persistence use local PostgreSQL-compatible
  tests; browser scenarios simulate API responses. They are not hosted acceptance.
- Email preference is stored for future setup. Real notice records always say
  `disabled`; a database constraint prevents a false `sent` status. A test-only
  adapter can simulate success/failure and explicitly reports no external send.
- Missing-submission reminders are a separate disabled event. Meaning and cadence
  need review; overdue staff delivery never implies a missing athlete submission.

## Still missing before activation

- Review and approval of the complete migration/permission scope, hosted rehearsal,
  backups and a coordinated frontend/native rollout. See
  [the exact migration review](../../backend/PILOT-MIGRATION-REVIEW.md).
- A separately approved and verified scheduler for automatic checks and recurring
  expectations. Until then, staff must run checks manually. There is no cron.
- Dedicated sender setup, authenticated templates, transactional outbox/worker,
  provider delivery/retry/bounce handling and actual inbox acceptance. No email is
  queued or sent by this slice; simulated adapter success is not provider delivery.
- Final reminder meaning/cadence, real package terms, retention preferences,
  physical iPhone tests and qualified content review. Device push is separate.

Completed local checks: **290 unit/database tests**, **252 broad desktop/phone
browser cases**, a **14-case affected-journey rerun** after the effect/reminder
changes, and **4 notification cases** after the final athlete-name presentation
correction. These reruns overlap; they are not additional unique test totals.
Lint, types, build, 11 Python checks and the existing account Edge Function's Deno
type check passed. The final **8 PWA/offline** and **2 isolated-preview** cases also
passed. The 11 delivery SQL cases passed again after making their fixture dates
independent of the weekday the test runs. The build retains its bundle-size warning.

Tests cover override precedence, version conflicts, DST, future content, grace
boundaries, approved/full availability, duplicated events, pause/cancellation,
assigned-coach scope, private household/guardian routing and read/unread behavior.
