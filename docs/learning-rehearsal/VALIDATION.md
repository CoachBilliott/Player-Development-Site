# Harness validation, not hosted acceptance

Original feature source59ac534 remains green and unchanged in its own worktree. This separate branch adds only a test frontend, its configuration/tests, ignored build outputs and browser handoff documents. It is not a production application release and has not changed any provider setting or data.

Completed local checks on the final harness:

- ESLint and TypeScript pass without warnings/errors.
  -5 policy tests pass: reject privileged/user/wrong-project keys; reserved accounts and synthetic paths; fixed-host/endpoint transport; learner key markers; strict redacted receipt export.
  -8 desktop/phone intercepted-response browser tests pass: configuration makes no requests before sign-in; target CSP; accessible initial form/phone overflow; in-memory session and clear/reload; real-client protocol with mocked provider; tampered JWT; raw key denial; paired known-profile controls; disabled features blocked; original file upload/sign/read; normal resource submit/approve; expired identity blocks checks instead of claiming RLS passes. Test trace/video/screenshots are off and all provider traffic is intercepted. These are NOT live Auth/JWT/Storage results.
- Isolated Vite production build passes. Generated build has no public/provider key, content-config or production endpoint binding; only hardcoded testhost permissions. No service worker or persistent Auth storage is installed.
- Local PostgreSQL/PGlite compiled seed/flag scripts against the approved baseline:6 fictional roles/3adultprofiles; duplicate seed refused; onlylearning.enabled toggled while scheduler/notices/youth remainfalse. These scripts have NOT been applied by this coding task to the hosted test project.

A mock handler routing error initially caused two resource-review test failures. It was fixed; the complete final8-check rerun is terminal green. No protection/assertion was removed. The harness includes original Shared learning components and uses ordinary user sessions, not the fake transport from the separate design walkthrough.

Pending: documented public test config from the owner UI; six securely managed disposable identities; approved role/profile seed and test-only enabled flag; real browser/REST/Storage execution and redacted receipts; separate hosted SQL calendar/retry/rollback checks; reviewed cleanup. No hosted acceptance pass is claimed from schema grants, local mocks or source compilation. Standing Cron, outgoing mail, production activation, paid entitlements and native release remain excluded.

## Prepared standalone Athlete coverage, not deployed

October29: the existing six-account fixture lacks a standalone Athlete identity. Source now includes exactly one additional reserved fictional email (`repformed-learning-athlete@example.test`) and a mocked browser case proving its server-returned role does not gain staff authoring controls. This is prepared test-only client support; owner approval for a seventh account/fixture and any harness refresh is still pending. No account/credential, role data or provider setting was created or changed.

Lint/types, 5 harness policy cases, and 10 intercepted desktop/phone browser cases passed; the isolated build passed as part of browser setup. All provider traffic was mocked, trace/video/screenshots remain off. This does not establish actual Auth or hosted Athlete access. The public harness remains the prior deployed source1bb3f5e; do not promote this build without coordinating the exact approved test scope. The original six-account password helper remains restricted to its six fixed UUIDs and must not reset a seventh account.
