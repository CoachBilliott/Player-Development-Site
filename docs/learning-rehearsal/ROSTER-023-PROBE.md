# Migration023 real-role acceptance control

**Prepared source only. This document is not a deployment or hosted acceptance receipt.** This branch starts from exact currently deployed harness1bb3f5e, not the newer undeployed022/seventh-account harness. It retains the six-account allowlist, fixed isolated Supabase target, memory-only Auth, CSP and original controls. No new account, role, permission, key, flags or write RPC is added. Production and TestFlight15 are unchanged.

## Existing tooling gap

Deployed1bb3f5e has quiz-key/profile/Storage controls and real learning panels, but **no023paged roster probe**. Learning panels cannot substitute for023acceptance while all learning flags areOFF. Do not extract browser sessions or impersonate JWT claims in SQL to fill that gap.

This small addition adds a **Migration023 · roster acceptance** panel directly below Direct API boundaries on the Boundary checks view. It uses the existing page's ordinary Supabase clients; no password/session/token is read/exported. `auth.getUser()` and `current_account_role` verify the already-signed-in actor before each authenticated probe. Supabase SDK attaches its normal in-memory session internally. Only these read RPCs are used:

- `current_account_role`
- `staff_client_service_roster_page`
- `staff_athlete_service`

Requests have15second abort bounds. No legacy fallback is used; PGRST202/malformed/error responses cannot certify023. The known6AuthUUID/role mapping and existing3adult profile IDs are fixed to the approved fixture. If current data/assignments differ, stop and inspect; the probe does not rewrite them.

## Operator coordination and availability gate

The existing authorized browser operator owns the approved023install/test/rollback. **Do not run a second operator or migration.** Parent reports ordinary browser access is restored and read-only hashes/6identities/helpers/allflagsOFF/RPCabsent have been verified. No further transport retries are needed. The current old harness tab may have an Owner session entered privately; do not reload it or discard that session while source-only work is being reviewed.

These controls become available only after an explicitly coordinated refresh of the isolated harness alias through its established preview workflow. No deployment has been performed by this source pass. Updating this test-only frontend is separate from installing023; never reuse its disconnected or test config as production. Owner may need to re-enter existing fictional credentials privately after a refresh because Auth intentionally does not persist. Do not ask them to send passwords or the public key in chat.

Before applying SQL, verify the refreshed control exists and the normal fictional Owner can sign in. Press **Check signed-in roster scope**: with023absent it must be **blocked**, not passed. A missing RPC error is the expected pre-install observation and not an acceptance success.

## After the exact approved023installation

Keep learning/scheduler/notices/youthOFF. Use the existing signed-in actor, Boundary checks → Migration023panel:

1. **Check signed-in roster scope.** Owner/Manager expect all3known adult profiles and all-client scope; Coach expects exact assigned profiles only. Known coachUUID7853c212… has Fictional Avery/profile…0010. Other coachUUID2d136c01… has Fictional Jordan/…0011 and Fictional Other/…0012. Both are assigned Coaches: an actually unassigned-Coach scenario is **not covered** and no assignment changes are authorized here. Parent should receive explicit Staff access required denial from the installed RPC, not missing-function/session/network failure.
2. **Check roster paging and filters** (staff only). One-row pages reconstruct exact known authorized set; repeat preserves page; large requested page clamps; Avery/Jordan/Other and no-results/quoted search plus accent-insensitive combined search+age+position+coach filter match approved fixtures. Unassigned filter should be empty with the existing fixture assignments. No data is created to make a case pass. This is a small-data real-JWT check, not a1000-row hosted performance test.
3. **Check direct athlete detail scope.** Attempts known permitted profile IDs first as direct positive controls, then the known out-of-scope IDs through the existing015detail RPC. It is independent of023and works before installation and after rollback. Staff permitted records must return matching IDs; all other targets must give the exact existing scope denial. Parent's staff detail requests all deny. No unrelated media URLs or payloads are exported. This does not test private-Storage content or guardian learning access while learning isOFF.
4. **Check anonymous roster denial.** Uses the separate public-key-only SDK client without signing out the staff actor. Must get explicit permission denial. Pair with a successful installed-function staff control; a missing function/network failure is blocked. Its redacted receipt records roleanonymous, not the adjacent signed-in actor.
5. Download the fixed-field redacted receipt before switching roles. Sign out using the normal button, then privately sign in each of the other existing Manager/Coach/other-Coach/Parent/other-Parent identities. Private panel state clears on role change; receipts retain only fixed check names, roles, outcome and timestamps. Screenshot only after password fields are empty/gone. Never export full network headers/HAR/session/storage.
6. Existing operator runs exact approved rollback. After rollback **Check signed-in roster scope** must be blocked (missing capability), not use the old roster fallback. Run Check direct athlete detail scope again: existing015allowed/denied results must still pass. This separately confirms the existing detail API remains usable; missing023alone does not prove legacy continuity or the full dashboard UI. Preserve all history. Do not reinstall automatically.

## Honest coverage boundary

This capability closes the missing real-SDK roster API control. It does **not** implement production frontend deployment, a second current daily roster UI, page/detail/back focus acceptance in the production dashboard, role/assignment changes, a truly unassigned Coach, seventh Athlete identity, large hosted dataset/performance, Storage revocation,022/024installation, weekly release/grade acceptance, notifications or native-device proof. Existing PR21HTTP/PGlite tests cover their stated source cases; incomplete hosted cases remain blocked/not run. No scope is silently widened to make this rehearsal appear complete.

Local tests use intercepted HTTP and stubbed SDK clients, never genuine credentials. Their results must not be relabeled hosted passes. The source review commit and actual execution/deployment receipt must be reported separately.

## Local validation receipt —30October2026

15focused policy/unit tests passed, including10new probe cases plus5existing confinement/redaction cases.16desktop/phone browser cases passed using intercepted provider HTTP:8existing and8new. The final browser run rebuilds the isolated harness before navigating it. Lint and TypeScript checks passed. These counts overlap the focused checks and are not a hosted-role or aggregate-application CI pass. No screenshot/trace/video of filled credentials is captured; all browser inputs are random local fixture-only text, never a hosted password.

No current deployed page was refreshed and no migration/security/credential/flag/data mutation was performed. Source-only branch test/roster-023-harness is intentionally based on the existing deployed harness source1bb3f5e, preserving unrelated pending harness changes. No merge into main or new application release is requested.
