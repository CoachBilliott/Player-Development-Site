# Unpublished pilot migration and permission review

**Review only. Migrations 012–016 have not been applied to production.**
Installed migrations 001–011 must not be rerun. Source editing and local synthetic
tests do not authorize a production database/security rollout.

| Migration | Concrete change | Permission/data risk to approve |
| --- | --- | --- |
| 012 | Athlete-specific workout snapshots with explicit removal tombstones; existing account-wide defaults remain fallback | Owner-only assignment/preview; review legacy clients changing defaults for athletes without overrides, sibling isolation and resume invalidation. No backfill. |
| 013 | Read-only grouped-review validation | No durable group, entitlement or deadline. Declared duration is not independent media analysis. |
| 014 | Up to three reserved clips, one submission/deadline, assigned-coach feedback and explicit media cleanup | New creation setting defaults off. Existing five stored clips/account, per-file and declared shared-media budgets remain. Private signed URLs retain their existing expiry window. No automatic retention deletion or paid credits. |
| 015 | Explicit service-coach roster and narrow service projections | Owners/Managers read basic service metadata for all active clients in this dedicated Repformed database. Coaches read assigned athletes only. This broader staff metadata visibility requires explicit review. No unrelated raw profile, family-control, video or feedback grants. |
| 016 | Delivery rules/expectations, staff alerts and private client notices | Owner alone changes configuration/check state. Scoped staff manually evaluate; scoped alert routing controls acknowledgement. Client inbox is restricted to the current verified authorized adult holder. No raw browser table grants, scheduler, external sender or push. |

## Migration 016 behavior to approve

- New tables all use RLS and deny raw `anon`/`authenticated` reads and writes.
  Checked security-definer RPCs expose narrow projections with fixed search paths.
  Helpers and the monitoring activation table are not browser-callable/writable.
- Owners configure package defaults and client/athlete overrides. Managers read
  their roster's rules and acknowledge alerts; they cannot change delivery defaults,
  roles, billing or account consent. Coaches can read/evaluate only explicitly
  assigned athletes, with review-ready events limited to their assigned reviews.
- Overdue alerts never target clients. Assigned-coach routing falls back to the
  existing Owner/Manager queue; escalation is a stored queue state, not a message.
- Content notices target the verified adult profile owner. A minor profile needs
  parent account type, the existing guardian confirmation/review and enrollment
  gate. Linked junior accounts are not notification recipients. Existing enrollment
  and private-media gates remain closed.
- Athlete nicknames appear only inside that authorized adult's private inbox to
  distinguish family members. No email body, media link or public player page is
  created. Staff overdue alerts remain separate from these client content notices.
- New notices are deduplicated by source/recipient event key. Manual observations
  use server time. Read timestamps are idempotent. Direct copied notice/athlete
  IDs do not bypass household or staff assignment scope.
- All email records are constrained to `disabled`; there is no live outbox worker,
  provider credential, network request or automatic event trigger. Stored email
  preference is an unfulfilled configuration request, not a promise of delivery.
- Monitoring defaults off in both database and frontend. After any future approval,
  a manual check still has to run. No recurring expectations or cron job is created.
- Stored rule snapshots keep existing expected deadlines stable through package
  changes. Pauses/cancellations affect current checks. These are monitoring states,
  not payment/refund rules or training-access revocations.
- Deleting a saved workout clears its expectation reference and makes that check
  unavailable; it does not block the existing deletion workflow. Deleting an
  athlete/account cascades its delivery configuration, alerts and notices.
  No automatic deletion/retention policy is introduced. Inbox reads return up to
  100 recent records; this is a display limit, not retention cleanup.
- This is one dedicated business deployment, not a new multi-tenant organization
  model. No other Supabase project is queried. Future multiple organizations need
  a separate tenant design before sharing this database.

## Required release sequence — none performed

1. Review the exact branch diff, RPC signatures, permission expansions and tests;
   confirm required package/day/time/zone and authorized staff responsibilities.
2. Obtain explicit production migration/security approval for the chosen subset.
   Capture backup/recovery evidence and rehearse against isolated hosted fixtures.
3. Apply approved 012–016 once, in dependency order, checking existing counts,
   RLS/direct API denials, private media and legacy workflow compatibility. Do not
   enable grouped reviews or monitoring merely because migrations were installed.
4. Review/publish the exact tested frontend. `staffRosterEnabled` and
   `deliveryMonitoringEnabled` currently default false. Review activation of each
   feature and backend setting separately; do not grant real accounts implicitly.
5. Verify actual Owner/Manager/Coach and adult client accounts on hosted APIs and
   website. Release a separately approved native build and test real iPhones.
   TestFlight build 13 does not contain these bundled changes.
6. Approve sender/scheduler work separately when the owner is ready. Validate real
   recipient delivery, retries, retention and consent before enabling automation.

If rollout fails, stop new observations/submissions and disable relevant frontend
flags while investigating a forward fix. Preserve assignments, review history
and notices. Do not drop tables, restore old function definitions blindly, expand
private-media access or automatically erase customer uploads to free capacity.
