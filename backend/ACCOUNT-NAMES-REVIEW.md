# Optional adult account names — draft incremental release plan

No production migration, merge, deployment, settings change, account backfill or
hosted database query is authorized by this task. This is a reviewable draft.

## Migration reservation and scope

The names delta is **`backend/025-account-names.sql`**, not migration 019. Do not
edit or renumber installed migrations or the separately staged learning/roster
migrations. Repository metadata was inspected without accessing any database:

| Number | Reserved migration                      |
| ------ | --------------------------------------- |
| 019    | `019-weekly-learning.sql`               |
| 020    | `020-learning-media-retention.sql`      |
| 021    | `021-learning-service-workflows.sql`    |
| 022    | `022-package-week-completeness.sql`     |
| 023    | `023-staff-roster-pages.sql`            |
| 024    | `024-weekly-notification-overrides.sql` |

All six are present on the inspected
[integration ref `66e7e460dd88ea85b9dcf6781d6048546ab4350b`](https://github.com/repformed/Player-Development-Site/tree/66e7e460dd88ea85b9dcf6781d6048546ab4350b/backend).
019–022/024 were also verified on `feat/weekly-learning-plans`, and 023 on
`feat/scoped-roster-pages`. These are **reservations, not proof of installation**.
This feature branch does not import or change that staged feature work. Its
names delta uses the existing account/lifecycle contracts from 001–018 and is
independent of 019–024. It was originally generated with
`supabase migration new adult_account_names`, then renamed to this repository's
reserved number before any hosted application.

## Behavior and privacy

Account settings offers optional **Your name**, disclosed as visible to the
account holder and Repformed Owners. It is self-entered, not verified identity.
Owners cannot edit other names. No names are inferred from emails, interest
responses, children, staff biographies or existing accounts. No records are
populated by this migration.

People & roles shows a supplied name first and its exact email underneath.
Missing names retain email fallback. Duplicate names remain separate by UUID and
email; role confirmation includes exact email, UUID and existing access version.
Email search, order, limit and scope are inherited from the unchanged v1 RPC.
Installed clients and training/assignment callers keep their existing signatures.
The isolated private preview supports both directory versions and own-name reads
while explicitly refusing name/role writes.

025 adds an RLS-protected names table keyed to `member_accounts`, own-row SELECT,
nullable space-trimmed names, 100 Unicode codepoint/control validation, a separate
optimistic name version/timestamp and erasure cascade. Clients cannot directly
INSERT/UPDATE/DELETE. No Owner table-read exception is introduced. The v2 Owner
RPC joins nullable names after v1's account selection and limit.

Self-save derives its write target from `auth.uid()`, verifies the matching
expected user ID, and requires verified email, an existing adult-confirmed member
account with a privacy acknowledgement timestamp, no guardian management and
no cleaning/failed closure. Both timestamps are checked explicitly. It acquires the
same lifecycle advisory lock (seed 1011) before member/name row locks and checks
eligibility afterward. It does not change roles, role versions/audits, onboarding
rules, consent records or any existing RPC definition/grant.

Drafts stay only in component memory keyed by user, with late-result guards,
cancel/removal, offline write blocking and reload after unconfirmed writes.

## Explicit staff adult/privacy setup

Verified existing Owners, Managers and Coaches without a member-account consent
record can choose **Review adult/privacy setup** in Account settings → Your name.
This does not interrupt staff tools or force the customer profile workflow. The
form starts with both checkboxes unchecked, shows the signed-in email, and
requires the person to accept themselves:

- “I am 18 or older and will only add adult players.”
- “I understand what is stored and how to delete profile data. I will use
  nicknames and keep identifying child information out of profiles.”

The profile privacy dialog is the existing disclosure extracted verbatim into
`ProfilePrivacy.tsx`, shared with the normal setup UI. The new route uses its
existing current `adult-pilot-lifecycle-2026-10` version, exactly matching the
server-validated acceptance version. It explains separately that these profile
rules concern player profiles, while the optional account name remains visible
to its holder and Repformed Owners. No policy text or new legal version is
invented. Adult status remains self-attested, as the existing disclosure says.

The new `complete_my_staff_account_setup` RPC targets only `auth.uid()` and
requires its matching expected user ID, verified email, an existing staff role
and matching role version, both true acceptance values, the current disclosure
version, no guardian/active family link and no cleaning/failed closure. The existing verified staff role is the admission boundary: this route also
serves already-approved staff created after the customer legacy cutoff, without
creating an Auth identity or assigning a role. General customer/invitation setup
rules remain unchanged; this route never opens signup or repairs inconsistent
records. Staff access establishes eligibility to accept, never consent itself.

The existing general setup RPC can create a new customer's first role and has
different admission rules. The scoped RPC therefore reuses the existing member
record schema and disclosure rather than calling that broader operation. It
creates only the missing member/consent record for that already existing staff
identity after explicit acceptance, and records the existing current disclosure
version on that new self-created row. It creates no Auth user, changes no role,
role version, role audit or publishing membership, and creates no player profile.
Existing valid consent records return idempotently without changing timestamps,
account type or privacy version. Existing incomplete records require review;
missing timestamps are never inferred or filled in bulk/on someone else's behalf.

Lock order is the existing role-administration advisory lock `73024001`, then
per-account lifecycle advisory lock (seed 1011), then a short **NOWAIT SHARE**
member-table guard and the own member row. The NOWAIT guard is necessary because
the installed legacy setup primitive inserts a member before its role trigger
acquires the lifecycle lock. It refuses an already-in-flight legacy member DML
instead of waiting in the opposite order and creating a deadlock. The existing
primitive and closure functions are unchanged. Under contention the UI requires
a reload and fresh unchecked acceptance; it does not automatically retry.

Successful setup unlocks the separate optional name field. Names are not saved
as part of acceptance. Cancel, reload, sign-out, role-version changes and account
switches clear draft acceptance. Offline writes are blocked, repeated clicks are
locked, and a lost/unconfirmed response requires a read before another attempt.
No production records were queried, so actual affected identities/counts remain
unknown. TEST rehearsal, release review and physical iPhone testing remain gates.

## Existing hosted TEST project — incremental rehearsal only

The intended existing TEST project is `ojcfrfpeftvngyluomex`. Release-owner review
reported that it is populated and not accessible with the current connector.
No hosted database has been inspected by this implementation. Stop until an
explicitly authorized connection to **that TEST project** is available; do not
substitute production or an environment's default configured project.

1. Confirm target project identity through the authorized project/connection
   metadata. A database name such as `postgres` does not identify a project.
2. Under separate read-only authorization, run
   **`backend/account-names-preflight.sql`** against the verified existing TEST
   target. It reads catalog metadata only, not names/emails/accounts/profiles.
   Review required table/column contracts, v1 Owner scope and function grants,
   RLS policies, existing names-object collisions and migration-ledger presence.
   Review the existing installation ledger separately if available; reservations
   in this repository are not evidence of what has been applied.
3. If prerequisites differ, objects collide or target/access is uncertain, stop
   and obtain a reviewed delta plan. Do not replay base migrations to repair it.
4. Only after separate migration approval, apply **ONLY
   `backend/025-account-names.sql`**, once, transactionally, to that existing TEST
   project. Preserve its populated data, auth/accounts, settings and migration
   history. Do not run `01-empty-test-atomic-install.sql`, replay 001–024, reset,
   seed, rebuild or replace the existing hosted TEST database. Do not apply a
   separate learning migration as part of this names rehearsal.
5. Re-run the catalog metadata preflight as a postflight and compare the approved
   baseline: unchanged pre-existing function definitions/grants and audience,
   correct new own-row policy/function grants, erasure FK and validation rules.
   Run Supabase advisors on TEST when that access is separately authorized.
6. Functional TEST checks require separately approved synthetic test accounts,
   with real self-service consent for those fictional test identities, and clear
   permission for any test data writes. Verify own/cross-user/anonymous access,
   stale saves, closure serialization, email fallback, Owner scope and v1
   compatibility. Do not use existing real account names as test data or invent
   consent for current staff. Verify the new explicit staff consent route with existing approved staff
   both before/after the customer legacy cutoff and with invitation histories.
   Nonstaff, unverified, guardian/family-linked and closing cases remain blocked. Consent must be accepted by the person testing their own
   identity; it must not be pre-populated for existing staff.
7. Production remains outside this task. Any later reviewed production plan must
   likewise apply only the approved names delta after metadata/target checks.
   **Apply and verify 025 before publishing the frontend**: no missing-RPC
   fallback exists. No web/mobile publication is performed by this branch.

## Local verification is not a hosted installation procedure

Vitest/PGlite and the optional
`node scripts/test-account-name-closure-lock.mjs` bootstrap **fresh disposable
local fixtures only**, then incrementally apply 025 to pre-existing synthetic
accounts. They must not be used as an install/reset/seed script for the existing
hosted TEST project. The compatibility test verifies that the delta preserves
populated member/role records and existing RPC definitions/grants. The metadata
preflight is syntax-checked locally before/after the delta.

A separate local PGlite compatibility run also applied the pinned staged
019–024 files from integration ref `66e7e460dd88ea85b9dcf6781d6048546ab4350b`
to fresh local 001–018, populated a fictional consented Owner, then applied only 025. Metadata pre/postflight, existing RPC/grant/member/role preservation and
consented own-name save passed. No staged migration source was copied into this
feature branch, and no hosted project was involved. This is local evidence only.

The Docker test uses pinned PostgreSQL 17 on the managed local daemon, no host
ports and no hosted connection. The six concurrency scenarios observe name/closure ordering, staff
setup/closure ordering, fail-fast legacy setup collisions, idempotent overlapping
acceptance and serialized role changes with stale-version rejection. They verify
actual advisory waits, consent preservation and cleanup cascade without granting
new authority. Its
throwaway container/database is removed afterward. Other tests cover nullable,
duplicate and Unicode names, grants, staff missing setup, stale versions,
account switching, offline behavior, invitations and responsive layout.
Local fixtures do not prove compatibility with uninspected hosted metadata or
replace hosted advisors, approved TEST rehearsal or physical iPhone testing.

## Rollback plan

No rollback operation is authorized or performed here. If a later release needs
rollback, restore the preceding frontend first; installed clients remain on v1.
Prefer retaining any supplied name data until the approved privacy decision.
A separately reviewed database rollback may remove only the names objects, in
reverse dependency order, after stopping new-client use and deciding how supplied
names must be retained/erased. Never reset the database or alter old migrations,
roles, onboarding, consent, invitations, v1 functions or existing grants.
