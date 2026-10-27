# Client-service dashboard review

**Implemented on the unpublished `pilot/core-journey-readiness` branch. Not live.**
All screenshots use fictional adult accounts and local API fixtures. Phone screens
are Chromium emulation, not a physical iPhone or a new TestFlight build. No real
purchase, email, minor profile or production permission changed.

## Screens to review

| View | Desktop | Phone |
| --- | --- | --- |
| Owner: all clients and athletes | [Open](owner-desktop.png) | [Overview](owner-phone.png) · [Athlete card](owner-roster-phone.png) |
| Manager: all clients | [Open](manager-desktop.png) | [Open](manager-phone.png) |
| Coach: assigned athletes only | [Open](coach-desktop.png) | [Open](coach-phone.png) |
| Athlete service details | [Open](athlete-detail-desktop.png) | [Open](athlete-detail-phone.png) |
| Website workspace | [Open](owner-website-desktop.png) | [Open](owner-website-phone.png) |

The roster is part of both the existing app staff home and website workspace.
Each row connects client, athlete, responsible coach, effective training plan,
current access/readiness, observed saved practice/completion and pending review
tasks. Filters expose overdue reviews, unassigned responsibility and training
attention. A detail panel opens from the athlete; Back returns to the roster.

Owners can assign or revoke **service-roster responsibility**. Managers and
Coaches cannot use this control. It does not assign existing private reviews,
change account roles, create billing access or expose unrelated videos.

## Truthful tracking

- Purchase/payment integration is absent: the view says **not recorded**. There
  are no fabricated orders, provider receipts, charges or paid entitlements.
- Eligibility and upload receipt establish readiness **now**, not the historical
  time content first became available.
- Schedule, first-available, opened and email telemetry are not implemented here.
  Missing activity reads **not observed**, not “never opened.”
- Saved practice/completion reflects reported participation, not improved skill
  or verification that the athlete performed the drill correctly.
- Existing 48-hour review targets provide overdue flags. Custom training-delivery
  alerts, missing-submission reminders, in-app notifications and email delivery
  remain queued. No scheduler or live notification adapter was enabled.

## Access boundary and tests

Owners/Managers read basic service metadata for all active clients in this
dedicated Repformed database. Coaches get only explicitly assigned athletes and
an opaque client reference rather than unrelated parent email addresses. There
is no multi-organization schema; this does not claim multi-tenant support. The
broader Owner/Manager metadata scope needs review before production. Raw profiles,
family controls, private video assets and feedback retain existing permissions.
Account closure freezes and assignment revocation apply.

Completed locally for this dashboard slice:

- **6 database-policy tests** against synthetic migrations 001–015: role scopes,
  direct API/table denial, reassignment/revocation, stale/idempotent writes,
  private-video isolation, missing profiles, withdrawn/incomplete content and
  account closure.
- **4 desktop/phone browser cases**: all-role rosters, details/back, overdue
  filtering, copied unauthorized athlete URL, revoked coach empty state,
  horizontal overflow and an automated accessibility scan of the Owner flow.
  Sessions are fixture-authenticated, not real hosted password sign-ins.
- Lint, TypeScript and production build passed. The existing bundle-size warning
  remains. Full combined hosted CI, hosted migration rehearsal, physical-phone
  acceptance and a new native build have not run for this slice.

Earlier grouped-review implementation in this branch passed **269 unit tests and
32 affected browser cases** before this dashboard addition. Those are separate
validation runs, not a new combined total.

## Minimum rollout steps — not performed

1. Review the combined source and schema/privacy changes in 012–015, plus backup,
   rehearsal and forward-recovery plans. Do not rerun installed 001–011.
2. Obtain coordinated production migration/release approval, rehearse and apply
   only approved migrations in order. No real account grants are implicit.
3. Verify the exact combined source in CI and the hosted API behavior. Publish a
   reviewed frontend with `staffRosterEnabled` enabled only after its backend is
   ready; the committed default is **false**.
4. Keep grouped-review activation separate: migration 014's setting stays off
   unless separately approved. Storage quotas and retention do not grow.
5. Verify each staff role on the hosted website, then release an approved native
   build and test actual iPhones. Existing TestFlight build 13 is unchanged.

This review does not enable junior enrollment, payments, SMTP, notifications,
scheduled delivery or coaching approval of illustrative training content.
