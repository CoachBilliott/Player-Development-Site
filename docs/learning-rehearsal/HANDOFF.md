# Real Auth/Storage acceptance harness

This is an isolated frontend for existing test project `ojcfrfpeftvngyluomex` only. The coding management credential remains403; the harness does not call management endpoints, bypass that denial or use administrator credentials. Production `iilbulpqbuknhdpmtrvm`, installed build13, real users, payments, email and standing Cron remain excluded.

## Existing owner authority

> Assistant Sentinel_6a09744438548191a6d8f7e5b348e6e0: 'One additional approval is needed for realistic login testing: may I create up to six disposable fictional test accounts with temporary passwords only in the test project? This lets me verify that athletes, guardians and coaches can’t access each other’s private content. No real customers, emails or production accounts would be affected.'
> User Sentinel_c1b3c2de511c81919ef14f2f7257a7cd Oct28 22:48UTC: 'yes'

Only temporary test-user credentials are approved, not new privileged API keys, production credentials or broader scopes. Passwords/session tokens/signed URLs must not appear in chat, logs, screenshots, SQL history or artifacts. Use secure test-browser memory, decline password saving, no filled-credential screenshots, no outbound mail. The browser task01a17982-e5e1-7575-a6f1-ef9223738023 owns documented Dashboard setup.

## Setup and precise pending flag action

1. In the owner-signed-in Dashboard verify exact project URL/header. Auth → Users → Add user/Create user: create the six reserved addresses shown by the harness, with temporary high-entropy passwords held only in secure test memory. Auto-confirm without invitation/verification email; do not use Invite user. If supported UI cannot do this without mail or leaking credentials, stop that phase. Do not mint an admin key or call hidden Dashboard APIs.
2. Run `03-seed-fictional-context.sql` in the same test SQL Editor after review. It refuses other users/existing application fixtures and seeds only six roles, two fictional parent contexts, three adult profiles and scoped coach assignments. It creates no Auth login credentials. Do not accept real legal terms or interpret fictional timestamps as actual consent.
3. Requested operator confirmation: may the test project's `learning_settings.enabled` change fromfalse totrue for these synthetic adult tests? `04-enable-learning-only.sql` performs only that transition with fixture/flag guards; scheduler, notices, youth, email, intake and monitoring stayoff. No Cron installation or production change. This file has NOT been executed by the coding task.
4. From this project's documented Settings → API Keys or Connect UI, read its existing PUBLIC publishable/anon key only. Do not click Reveal on Secret/service_role keys. Enter the public key into the harness; it is nonsecret, held in memory, and not written to source. There is no key-generation or persistent credential-configuration step. The hostname is hard-coded to the exact test project and both CSP and fetch guard reject production/management/function URLs.

## Observe real boundaries

- Sign in with normal disposable-account email/password. The harness calls Auth password sign-in, server getUser, then the guarded current role RPC; it never offers a role override. Sessions/passwords are not stored in localStorage/sessionStorage. Reload requires configuration/sign-in again. The role refresh button clears private panels/paired controls; sign-out clears private component state.
- First Owner: prove allow on all three fixture profile IDs ending0010,0011,0012 (full IDs in seedSQL). This registers that deny targets exist. For each Parent/Coach, prove an allowed profile, then a previously verified out-of-scope profile. Disabled flags, missing positive controls and network errors are BLOCKED, not passes. Parent owns10/11, otherParent owns12; Coach assigned10, otherCoach assigned11/12. Owner/Manager can readall.
- Check anonymous/signed-in direct quiz-key denial and tampered-JWT rejection. Tampered JWT uses a current normal-role positive control first; it never logs the token or creates a privileged credential.
- Staff upload button generates one original synthetic text lesson into the existing private training-media bucket. It verifies actual signed download bytes and creates a private draft resource through normal RLS. Interrupted responses reuse the stable path and require confirmation, not fake success. Do not use camera/library or real athlete media.
- Use two separate samples/plans for the two households: a file deliberately assigned to both is legitimately shared and not a valid cross-household denial target. Prove allowed signing/bytes for each account, then denial of the other known sample. The harness keeps nonsecret known-path controls across sign-outs; it does NOT display/export signed URLs. Signed bearer URLs can remain valid until their requested60-second TTL; withdrawal blocks new signing but is not immediate copied-link revocation.

## Actual learning UI

Actual learner/staff views reuse LearningAthlete, QuizRunner and StaffLearning from the tested feature source. No fake transport. Staff bank → Refresh real test resources loads scoped resource IDs. Existing normal resource submission/approval is still required before a plan week can use it; upload is not approval/delivery. The harness provides normal Submit sample for review and Owner/Manager approval buttons, calling the documented guarded RPC under the actual user session. Never use an admin key masquerading as a learner. Controlled withdrawal choices come from the authorized test catalog and require explicit confirmation.

Prepare a two-week synthetic plan and an approved orientation week0 containing the original lesson and example CSV quiz. The Owner grants manual test eligibility (not payment), enrolls the exact profile; approved orientation becomes available immediately without changing Sunday timing or enabling the scheduler. The Parent takes/saves/submits the quiz, assigned staff grades written work, and role/household checks repeat. Use a separately scoped plan/sample for the other household. Earlier version/attempt history must remain after re-import/approval changes. No qualified coaching review or finished curriculum is implied by these fixtures.

Sunday/Friday/DST/tick/retry/rollback checks remain separate operator-run synthetic SQL transactions/dry-runs. There is NO scheduler button and ordinary authenticated users cannot execute learning_tick. Do not mark those hosted cases passed from the harness or from local mocks. Do not enable notices/scheduler just to dismiss a blocked UI result.

## Receipts and cleanup

Download redacted JSON: fixed check name, verified role, result and timestamp only. It excludes passwords, keys, tokens, signed URLs, quiz answers and file contents. It reports observed checks only; local intercepted-response tests are harness validation, not hosted acceptance.

After the real checks, the owner browser removes only the exact tracked synthetic Authusers/files/rows and confirms cleanup/flags. No reset, blind deletion, automatic deletion of retained originals or new bucket/quota. Retained sample deletion requires a reviewed test-only cleanup order because020 protects snapshots. Disable learning after tests; keep baseline/schema for review. Root coordinates any further cleanup or timing flags.

## Local harness validation commands

`npm run lint`; `npm run typecheck`; `npx vitest run --config vitest.learning-rehearsal.config.ts`; `npx playwright test --config playwright.learning-rehearsal.config.ts`.

The browser checks intercept all Supabase traffic and run only against localhost5201 with trace/video/screenshots off. No live credential is accepted by these tests. This validates the harness, not provider behavior. No production source, hosted access setting, SMTP or native release is changed by this branch.
