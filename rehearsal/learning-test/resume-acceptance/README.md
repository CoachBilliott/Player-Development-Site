# Resume hosted learning acceptance

Prepared October 29, 2026. **Latest browser attempt14:51UTC remains blocked by ERR_QUIC_PROTOCOL_ERROR before any render/sign-in; no credentials, data, flags or network settings changed.** This is a bounded handoff and read-only preflight, **not a hosted acceptance pass**. Production stays at `7c60c4ba16b1e9a0d6a18a60268ab5fe7897fbba`; PR13 `f078d1bc237b0e168f6ed0cf9c241367c5a7fc08` remains draft/unmerged/off. Do not create a replacement project/task.

## What is established

- Current PR13 CI40890247154 passed: 430 unit/database, 404 website, 10 compiled-app/offline, 20 fictional-preview, 11 Python, lint/types/Deno/build. Counts overlap other runs. These are not actual hosted-role or physical-device results.
- Existing harness: https://learning-auth-rehearsal.repformed.pages.dev/ ; deployment `eeea6899-8e3f-461c-9230-35287d8e1d3d`, source `1bb3f5e9661fa9b3d7d8131fa8752e9d557f49ff`. Cloudflare provider metadata still reports successful preview deployment at 14:36 UTC. This does not prove browser availability.
- All 14 learning runtime files and migrations019–021 exactly match current feature source. Other inspected differences are added tests and a service-detail scroll-padding rule; that modal is not mounted by the harness. No functional rebuild or new migration is needed merely to resume the six existing roles. A seventh standalone Athlete needs the separately prepared fixed-client-allowlist update after approval. See SOURCE-COMPATIBILITY.json.
- Earlier coordinator evidence established six ordinary guarded sign-ins/profile RLS and a synthetic private lesson upload. It did not complete quiz import, enrollment, scoring, written grading, released history or cross-household lesson-file acceptance. Current sessions are not established.
- The authorized dashboard worker last verified test learning/scheduler/notices/youth OFF at 12:21 UTC, and zero quizzes/versions/attempts/grades/enrollments. Preserve existing plans, samples, accounts and history; do not reseed or rerun the empty-project install.
- Last authorized browser navigation failed ERR_QUIC_PROTOCOL_ERROR. Coding-worker frontend403/1010 and management403 are separate restrictions and have not been retried/bypassed.

## First actionable gate: ordinary browser and secure sign-in

The coordinating browser task must establish whether the existing harness opens by ordinary supported navigation. No protection/protocol changes, alternate identities, privileged API assertions or replacement hosting. If normal access still fails, report exact browser transport error and stop dependent hosted tests. Successful Cloudflare metadata alone is insufficient.

Use only the documented existing PUBLIC test-project publishable/anon key, entered into the in-memory harness configuration. No key generation, privileged key reveal in agent tools, persistent binding, Auth SMTP reuse or management API is needed. The harness hardcodes `ojcfrfpeftvngyluomex` and blocks production/management/function endpoints.

No completed password-recovery receipt is present in this task evidence. Coordinate with the owner before any reset so an already-completed recovery is not repeated. If still needed, the already-approved [owner-operated helper](../owner-recovery/README.md) uses private non-echo laptop prompts and the existing test admin credential for exactly the six fixed users. Recheck Password changed notification OFF immediately before applying; the 01:59 observation is stale. The owner keeps passwords and enters each directly into the harness. Never pass passwords/keys via chat, logs, files, screenshots, SQL history or agent tool arguments. There is no secure cross-task password handoff/binding established here. The helper has not been run by this coding task.

## Read-only state preflight

After verifying the exact signed-in Dashboard URL/header is test project `ojcfrfpeftvngyluomex`, the authorized owner browser can review [01-current-state-read-only.sql](01-current-state-read-only.sql). It returns fixed-fixture booleans, counts, safe flags, bucket limits and privilege checks only. It begins READ ONLY and rolls back. A project literal/current_database() is not identity proof. Never execute in production. No automatic repair, reset, account creation, media read, grants or flags change.

All identity/role/profile booleans must be true. All four learning flags and excluded email/intake/monitoring/youth controls must be false. All18 learning tables must retain RLS, authenticated tick and raw quiz-key grants must be false, buckets private. Unexpected data/flags/grants mean STOP and review, not deletion. Counts are observations; previously zero activity is not a reset requirement. LOCAL-PREFLIGHT-VALIDATION.json records nine local-only guard checks, not hosted results.

## Smallest additional action-time approval

Do not apply now. Once browser access and secure login are established, request approval to enable **only** `learning_settings.enabled` temporarily in this existing isolated test project for fictional-adult plan/quiz/file acceptance. Scheduler/notices/youth and all outgoing email/standing jobs remain OFF; restore learning OFF and verify at session end, preserving history. This does not authorize production or new permissions. Existing schema and roles are reused.

The six accounts cover Owner, Manager, two Coaches and two Parents, with three fictional adult profiles. They do **not** include a standalone Athlete Auth identity. Full every-role acceptance needs a separately approved **seventh fictional adult Athlete account**, created through the supported test Auth UI with auto-confirm and no invitation/recovery email, owner-held temporary password, one own adult profile and the existing ordinary Athlete role. Do not repurpose any of the six, generate an admin key or open youth registration. If this is not approved, mark standalone Athlete acceptance BLOCKED rather than passing the Parent journey as equivalent. Test-only fixture setup for that account must be reviewed before execution.

## Hosted acceptance order and honest results

| Slice | Required observable outcome | Current hosted status |
| --- | --- | --- |
| Identity/roles | Server-confirmed Owner/Manager/assigned and other Coach/each Parent; direct off-scope denies after positive known-row control | Earlier limited observations; fresh sessions pending |
| CSV quiz | Import supplied blank/example contract, review/publish; malformed import atomic; re-import creates version2 while old attempt stays version1 | Not completed |
| Athlete enrollment | Existing approved sample plus immediate orientation, exact sibling eligibility, Owner enrollment, no duplicate, group new/kept/blocked correctness | Not completed |
| Take/grade | Parent/authorized athlete saves, resumes and submits; server objective score; assigned Coach written grade; unauthorized grading/key reads deny | Not completed |
| Media/history | Allowed signed download bytes, other household known-file denial, withdrawal blocks new signing; existing signed URL expiry documented; versions/grades persist | Not completed |
| Sunday/Friday/capacity | Midnight Chicago/DST, incomplete-only Friday, pause/end/retry/no flood, approved-ready capacity only, staff-only scope | Source tests passed; hosted logic not completed |
| Standalone Athlete | Actual ordinary Athlete login and own-profile journey/other-household denial | Additional fictional account approval needed |
| Physical app | Installed build, camera/library/upload/playback and persistence | Not established; build13 unchanged |

Use the existing real components/harness, not its mocked local tests. Keep two separate sample files/plans for households; a file deliberately assigned to both is not a valid denial target. Preserve approved historical versions and no real minor/media data. Do not label uploaded/draft/future content delivered. No payment/billing telemetry is implied by manual test eligibility.

Calendar logic may be exercised only after separately approved **test-only manual SQL simulation**, with no Cron. Prefer a single BEGIN/ROLLBACK transaction: temporarily enable scheduler/notices only inside that transaction, call the existing service-role-only tick for reviewed synthetic times, inspect dedup/release/notice rows, then ROLLBACK and verify all flags remain OFF. This proves hosted SQL behavior, not a standing scheduler or actual persistent inbox delivery. An ordinary-browser inbox-scope check may additionally need explicitly reviewed committed synthetic notice fixtures; do not claim a rolled-back event appeared in another session or silently enable notices. No real emails or historical backfill.

Existing source evidence: learningPolicy.test.ts cases for Sunday DST, idempotent tick/dry-run, Friday boundaries/no stale nags, capacity resolution/reopen, per-enrollment partial failure, scoped group gradebook, atomic groups, immutable attempts, parent permissions and flag rollback. These pass in PGlite, not hosted Supabase.

## Production activation remains separate

After hosted cases pass, review019 private learning/RPC/erasure permissions,020 retained-media/read/delete restrictions and021 scoped roster/group wrapper together; approve exact production scope only then. A usable production data/Storage backup and restore procedure is still unverified. A frontend rollback artifact is not that backup. Retention duration/cost/expiry/refund policy remains unresolved. No production migration, role grant, Cron/extension, key, new recipient, staff email dispatcher, payments or youth access is authorized by this checklist.

Existing package/client delivery-monitor settings do not automatically configure learning's global Friday/ready-week defaults; staff low-content in-app logic exists, but operational email wiring/activation remains separate and OFF. Do not present those integrations or background monitoring as live.

## Reproducing the local preflight checks

`validate-local-preflight.mjs` is the exact local validation script, using the preserved original coding-workspace bundle, harness seed and PGlite dependency paths under /workspace. It is not an owner password tool and makes no hosted requests. Run only inside that coding workspace; the browser operator needs only the reviewed read-only SQL. No new broad regression run was needed for these documentation/preflight-only additions; the feature source and green exact-head CI are unchanged.

## Prepared seventh-account fixture (not approved/applied)

[02-proposed-standalone-athlete-fixture.sql](02-proposed-standalone-athlete-fixture.sql) makes the requested scope concrete: after separately approved official Auth UI creation of `repformed-learning-athlete@example.test`, it adds only existing-role Athlete data, an `adult` member account and own fictional 18+ profile `93000000-0000-4000-8000-000000000013`. It refuses missing/mismatched existing six UUID/email/role pairs, enabled excluded flags, unexpected or duplicate fixture state. It does not create an Auth user, set a password, change grants/schema, assign a plan/coach, send mail or touch production. Existing six rows/history remain intact. Local PGlite validated missing-user rejection, exact new adult fixture, unchanged original six and duplicate rejection.

The initial six-account read-only preflight is for BEFORE this proposed addition. After an approved seventh setup, its six-account booleans are expected to differ: use the fixture's bounded7-role/4-profile postflight and unchanged flags/grants checks; never delete/reseed to make old counts match. The prepared harness source supports the one exact extra address and server-returned Athlete role, but has NOT been deployed and cannot create an account. New identity/fixture/harness-refresh approval is pending. Existing six-account helper approval does not cover resetting a seventh.

Next owner action is ordinary navigation to the SAME harness URL on the laptop without entering secrets, to establish whether it loads outside the currently failing supported browser session. Do not alter protocol/security settings or bypass warnings. If it still fails, stop dependent acceptance and restore the supported browser connection through available platform support; this coding task exposes no browser recovery control. No more failed worker-side network retries are useful.
