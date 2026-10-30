# Optional adult account names — review and deployment plan

Draft feature only. Do not run migration 019, merge, or deploy until the release
owner reviews and authorizes this scope. No production data was read or populated
for this implementation. All test people are fictional.

## Behavior and privacy

Account settings offers **Your name**, optional, with a disclosure that the name
is visible to the account holder and Repformed Owners. It is a self-entered label,
not verified identity. Owners cannot edit another person's name. We do not derive
names from email, child profiles, interest submissions or staff biographies.

People & roles shows the supplied name first and the email underneath. Missing
names retain the email display. Duplicate names stay separate by UUID and email;
confirmation includes name, exact email, UUID and the existing role version.
Email-only search, order, limit and account scope are unchanged. Assignment and
training callers keep using the old directory RPC; installed clients keep all
existing signatures.

## Migration 019

Apply after the numbered backend migrations through 018. Generated using
`supabase migration new adult_account_names`, then stored as
`backend/019-account-names.sql` to follow this repository's deployment sequence.
The transaction adds only a private, RLS-protected `public.account_names` table
and name-related functions. The authenticated table grant permits own-row SELECT
only; no client has INSERT/UPDATE/DELETE. No Owner table-read exception is added.
The Owner-only v2 RPC delegates account selection/authorization to v1, and joins
nullable names after its limit. The old function is untouched.

Names are space-trimmed, optional/null, at most 100 Unicode code points, and reject
C0/C1 controls, Unicode format controls and line/paragraph separators. Whitespace
removal stores NULL while retaining and incrementing the version (no reset/ABA).
Records cascade away when the member account is erased. No backfill occurs.

The self-save RPC derives ownership from `auth.uid()` and checks a matching
expected user ID, verified email, completed adult setup, no guardian management,
and no cleaning/failed account closure. The extra expected ID rejects a request
that starts while the browser changes users. A member-account row lock serializes
first saves; a separate name version rejects stale writes. It does not alter role
versions, invitations, role audits, authority or privacy settings. SQL-definer
functions use an empty search path and explicit authenticated-only EXECUTE;
the internal eligibility helper is not callable by application roles.

The UI keeps drafts only in component memory, keyed by signed-in user. It ignores
late results after unmount, disables writes offline, allows cancel, and requires
a reload after an unconfirmed server write. Local validation errors remain
editable. No browser persistence or offline write queue is introduced.

## Review before release

1. Review the code and privacy copy, particularly the Owner directory audience and
   the treatment of existing staff who have not completed adult setup. Such users
   cannot save a name; this feature does not bypass setup or create a new setup
   route. Guardian-managed accounts cannot use this adult field.
2. Rehearse 001–019 against a disposable Supabase project at the deployed Postgres
   version. Run the actual Supabase advisors there; PGlite catalog assertions and
   policy tests are local evidence, not a hosted advisor run. Confirm grants,
   RPC response shapes, migration order and erasure cascade.
3. When separately authorized, apply 019 transactionally, then verify self read/
   save, non-Owner directory denial, Owner scope, stale writes and unchanged v1
   using synthetic accounts on that rehearsal project. Do not use real names.
4. Publish the web bundle only after the RPCs are available, using the existing
   release owner's workflow. Rebuild installed clients separately as appropriate.
   This branch performs no publication, mobile build upload, or database change.
5. Confirm with a real Owner/adult in the authorized release that optional name
   entry and email fallback behave correctly at phone and desktop sizes. Native
   physical iPhone testing is not covered by browser emulation.

## Rollback

First restore the preceding frontend bundle. Existing installed clients still
use v1 and remain compatible. Prefer retaining the new name table until the
release owner decides how supplied personal data should be handled.

If separately approved, stop all new-client use, export/retain any supplied names
according to the approved privacy policy, then remove only the new objects in a
transaction, in this order:

```sql
begin;
drop function public.list_account_access_v2(text);
drop function public.save_my_account_name(text,integer,uuid);
drop function public.get_my_account_name();
drop function public.can_save_account_name();
drop table public.account_names;
commit;
```

Dropping the table erases names. No rollback should alter `account_roles`, v1
RPCs, invitations, setup, auth credentials, or grants on existing objects.

## Validation

Local PGlite tests verify own/cross-user grants, anonymous denial, verified/adult/
guardian/closing guards, stale versions, account-switch mismatch, optional removal,
Unicode/control/length rules, duplicate names, erasure cascade, exact directory
scope/limit/search parity, and function privilege/search-path configuration.
The full existing Vitest suite covers role and invitation regressions. The latest
migration is also applied after the complete 001–018 chain in the migration
compatibility test, which verifies existing RPC definitions and grants are unchanged.

Playwright covers name edit/save/cancel/removal, validation, offline behavior,
reload after failure, user switching, duplicate-name disambiguation and unchanged
role confirmation/cancellation, at desktop and iPhone viewport sizes. Existing
account, lifecycle, private workspace and staff-workflow suites are run alongside.
