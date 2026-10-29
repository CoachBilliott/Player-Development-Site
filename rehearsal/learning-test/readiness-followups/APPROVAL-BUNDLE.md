# Bounded server-roster approval bundle (prepared, not approved)

Prepared from PR #21 d791232c91cbdfdcc00cb6a6d3d70d3ee98d0e53. Final CI and hosted acceptance must be recorded separately. Production and TestFlight remain0816c343; paging flag false. No hosted migration executed.

## Test rehearsal first

Proposed target: existing isolated Supabase **ojcfrfpeftvngyluomex** only. Apply exact **backend/023-staff-roster-pages.sql**, SHA256 **f809984c4003f9a01308ebfa9931be3bca76b5bbbf52386f78689861d35d03be**, after verifying existing015helpers, current recovery/definitions, four learning/scheduler/notices/youth flags OFF and normal authorized browser/Auth access. Reuse existing six fictional users; no production users, new accounts, credentials or outgoing email. Test only scoped reads, authorization denial, counts/facets, partial/missing media, pagination/stale replies, and actual rollback preserving records. Prior denied management access is not permission to use another credential/route. Current normal browser availability is unverified; latest parent browser evidence was ERR_QUIC. Do not call local PGlite or HTTP fixture success hosted acceptance.

## Production action, only after hosted rehearsal

Target: existing Repformed Supabase **iilbulpqbuknhdpmtrvm**. Add only 023 (not a glob of draft migrations):

- Guarded security-definer **read** RPC `staff_client_service_roster_page(text,text,text,text,text,integer,integer)`, authenticated Execute. Current server role and closure checks allow Owners/Managers all existing Repformed clients, Coaches only explicitly assigned athletes. Parent/Athlete/anonymous get no rows/counts/facets. Counts/search apply scope first; Coach hidden client emails are excluded before searching.
- Private normalization helper `staff_service_search(text)`, no Public/anon/authenticated direct Execute.
- Two indexes on existing coach/profile and review/profile/assigned/state/due columns. One transaction; 5s lock and60s statement bound. Abort on lock/dependency error; do not force.
- After actual acceptance enable only `staffRosterPagingEnabled:true` in a separately tested normal-auth release. New API enriches only bounded selected page. No table/RLS/role/media grants, new data fields, access writes, email, scheduler, learning, credentials or billing.

## Recovery

Record existing function/grant definitions, row counts, deployment/configsource before execution. If required helpers absent stop; do not install012–014/019–022 to guess dependencies. Rollback exact `backend/rollback/023-staff-roster-pages.sql`, SHA256 **6eea1f2e2688a822880b1af0d829b7bb34d7e2ab35cf17bf2edac36328966a26**, drops only newRPC/helper withoutCASCADE, preserves data/existingACLs/functions/indexes. Existing missing-capability PGRST202 can return to authorized legacy path, clearly marked slower; permission/Auth/error/timeout do NOT fall back. Webflagfalse restoreslegacy; nativebundledflag requiresnewbuild unlesscapabilityabsent. No destructive recovery or automatic deletion.

## Exact owner question, when final checks are complete

“May I rehearse migration023’s guarded paged roster read and two indexes in test project ojcfrfpeftvngyluomex using the existing fictional accounts, then—only after that passes—apply the same reviewed migration to production iilbulpqbuknhdpmtrvm and enable its roster flag? Owner/Manager and assigned-Coach scopes stay the same; no roles, media access, learning, email, scheduler or credentials change.”

This file is a reviewable proposal, not authorization received and not an applied migration. PR #13 learning has its own broader security/recovery/acceptance gates and is excluded.
