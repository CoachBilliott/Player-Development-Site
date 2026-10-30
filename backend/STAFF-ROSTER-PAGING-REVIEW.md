# Staff roster pagination: deployment review

Status: source/local synthetic tests only. Migration023 is **not installed**. `staffRosterPagingEnabled` is absent/false in production configuration. Website/TestFlight15 remain on 0816c34; this draft does not enable learning, payments, junior enrollment, notices or scheduling.

## Exact proposed production scope

Target, after rehearsal and explicit action-time approval: existing Repformed Supabase project **iilbulpqbuknhdpmtrvm**. Apply only [023-staff-roster-pages.sql](023-staff-roster-pages.sql), not a glob of numbered drafts.

- Add `staff_client_service_roster_page(text,text,text,text,text,integer,integer)`, a stable security-definer read RPC with empty search path and fully qualified relations. Grant Execute to authenticated; revoke Public/anon. Inside the function, only existing active Owners/Managers/Coaches pass. Owners/Managers retain all existing Repformed client-service metadata; Coaches retain explicitly assigned athletes only. Parent/Athlete/anonymous callers receive no rows, counts or facets. No role or table-RLS grants change.
- Add private immutable `staff_service_search(text)` normalization helper; Public/anon/authenticated cannot call it directly.
- Add indexes on `athlete_service_coaches(coach_id,profile_id)` and `review_services(profile_id,assigned_to,state,due_at)`. Index creation uses the bounded 5-second lock/60-second statement timeout in one transaction. A busy/slow operation aborts the transaction; do not force locks or partially apply.
- Return the same existing rich service payload for the selected page only, plus scoped total/matched counts, client/athlete totals and age/position/assigned-coach filter choices. Owner/Manager email visibility is already approved migration 015 scope. Coach search/counts use the minimized visible client label, not hidden client email. Review counts still exclude another review coach's tasks.
- Read-only numeric pages with size 1–100 (UI 25), validated filters/search lengths, stable priority/name/ID ordering, and stale-page clamp. Filter/count scope is enforced in SQL before page selection. Full resources/review history are expanded only after selecting the bounded page; a 1,000-record local contract test measures25rich expansions.
- After real role acceptance, enable the separate static client flag `staffRosterPagingEnabled:true` in a normal-auth website/native release. Existing delivery-settings profile choices remain on their current scoped API; this batch changes the daily athlete roster only.

There are **no** new tables, personal-data fields, child access, private media grants, writes, role changes, billing, credentials, external services, retention jobs, emails or Cron. Existing single-project organizational boundary is preserved; this does not add cross-business access.

## Dependencies and compatibility

Only the existing migration 015 service helpers and the schema they already use are required. Preflight stops if `staff_athlete_service`, `staff_can_view_service_athlete` or `effective_workout_assignment` is absent. Do not install 012–014 or 019–022 merely to satisfy a guessed dependency. Production schema/installed definitions must be inspected by the authorized operator before applying.

This API describes the current legacy workout/service states while weekly learning is off. PR13 has a separate learning-aware paged API; its eventual integration must be merged/tested coherently before learning activation. This migration neither requires nor activates PR13.

A new client uses server pages only under the explicit true flag. A PGRST202 missing-function response can use the existing scoped legacy API during staged rollout/rollback, with an honest slower-loading notice. **Permission denial, Auth errors, other server errors, timeouts and malformed responses never fall back.** Legacy compatibility retains 25-row client rendering but does not claim server paging. Search is debounced 250 ms; obsolete requests are aborted and cannot overwrite newer results. Query/contact text is never put into navigation URLs.

## Rehearsal and evidence gates

Use only the separately authorized isolated test project **ojcfrfpeftvngyluomex** with the existing fictional users, if its supported ordinary Auth/browser access is available. No new privileged key or real person/child records. Apply this exact migration only after the target/permission scope is approved for that environment; no destructive reset. Learning/scheduler/notices/youth flags remain off.

Verify actual Auth/RLS behavior for Owner, Manager, assigned/unassigned Coach, Parent/Athlete and anonymous callers; direct guessed IDs, hidden-email searches, counts/facets, reassignment/revocation, account closure, 1,000 fictional records, ready vs missing/partial media, overdue review scope, duplicate reads, timeout/retry and rollback. Local PGlite/client/HTTP fixtures are preparation, not hosted acceptance. Do not modify production users to manufacture coverage.

Before production: record current function/grant definitions, row counts and deployment/config source; confirm rollback and no unexpected dependency. No data/storage contents are modified by this additive read-only migration. Whole-learning/media restoration remains the separate PR13 gate.

## Rollback

Use [rollback/023-staff-roster-pages.sql](rollback/023-staff-roster-pages.sql) only against the verified target and reviewed installed definitions. It drops the new read RPC/helper with dependency protection, reloads PostgREST schema, leaves all existing data/functions/ACLs and harmless indexes intact. Missing capability then uses the existing scoped client path, including installed native clients. Setting the web flag false also restores its original path; native bundled flags require a new build unless the capability is absent and the documented fallback applies.

Do not replace DROP with a permissive grant or bypass a denied response. Do not use CASCADE. Unexpected dependencies or lock timeout are stop conditions. No automatic cleanup/deletion is part of recovery.

## Minimal action-time approval wording

After final source checks, hosted rehearsal and review of the exact migration hash:

“Approve adding the migration 023 paged read RPC/helper and two indexes to existing Repformed project iilbulpqbuknhdpmtrvm, with the same Owner/Manager all-client and assigned-Coach scope, no Parent/Athlete/anonymous access, and enabling its client flag after acceptance? No role, private-media, learning, email, scheduler or credential changes.”

This draft wording is a proposed approval bundle, **not approval received**. The migration and true flag must stay unpublished/unapplied until the applicable exact permission and release gates are met.
