# Post-audit fixes: current checkpoint

**29 October 2026,21:42UTC. Website and TestFlight15 remain0816c343; no production change or hosted migration.** The21:14 [audit snapshot](FULL-AUDIT-2026-10-29.md) remains historical; this follow-up records subsequent fixes without retroactively grading untested areas.

## PR22 screenshot failure: fixed, final CI GREEN

- Head **cfe3dce95ce90f2e1df8eab7a90ab0817bc9e923**, [PR22](https://github.com/repformed/Player-Development-Site/pull/22).
- [FullCI40957228885](https://github.com/repformed/Player-Development-Site/actions/runs/40957228885) **SUCCESS**.378 unit/database,438 web,10 app/offline,6 private-preview,11 Python plus lint/types/Deno/build. App/private-preview stages completed, not skipped.
- Replaced hardcoded/workspace screenshot path with Playwright `testInfo.outputPath`. Both affected local desktop/phone checks and the final full suite pass; no test assertion removed and no filesystem permission change.
- [Isolated preview](https://sample-learning.repformed.pages.dev/#sample-week) remains deployed from30601cd. Final cfe3dce differs only in the test file: application src/public trees are identical. No duplicate deployment, production/native release or media-approval claim. Backend stays disconnected. Reviewed video/text and independent public browser acceptance remain separate gates.

## PR21 server roster: source GREEN, hosted approval PENDING

- Head **d791232c91cbdfdcc00cb6a6d3d70d3ee98d0e53**, [fullCI40953863302](https://github.com/repformed/Player-Development-Site/actions/runs/40953863302) SUCCESS:395 unit/database,448 web,10 app/offline,6 private-preview,11 Python plus checks.
- Exact [test-only request/files](../roster-023-review/REQUEST-AND-INPUTS.md) frozen at6eafbdb9212b5f92e60047a568295ae319d6cf33. Owner question sent21:40; answer pending. No023execution, new flag, production scope or additional credentials/accounts.
- Ordinary test-harness availability still needs verification. Prior management denial is not bypassed. Full role/large hosted fixture mutations beyond the minimal request need their own exact bounds.

## PR13 stale documents/conflicting main: repaired, combined full CI RUNNING

- Source **1858aaaaa9c438594c2c0ffed74d6bfb5549645b**, [PR13](https://github.com/repformed/Player-Development-Site/pull/13), [CI40959018944](https://github.com/repformed/Player-Development-Site/actions/runs/40959018944) running at this checkpoint; not a green claim.
- Source rollout/validation/matrix/inventory now identify current0816c343/TestFlight15 and existing isolated test target; historical source evidence is qualified.
- GitHub had stopped PR checks while the branch conflicted with main. Merged released0816c343 and reconciled the two conflicting roster/CSS files. Preserved current login/help,25-row legacy paging/detail/back/focus, overdue-review action and existing draft weekly cursor/enrollment/grades.46 affected desktop/phone checks plus types/lint passed locally. GitHub no longer DIRTY; aggregate CI is running.
- No migration/security/credential/scheduler/learning activation.022 completeness and all other learning functionality remain unreleased. Package/client-specific weekly reminders remain an actual integration gap; global defaults are not that feature. Final combined/hosted/restore/native acceptance remains required.

## Remaining owner inputs and gates

The [exact input list](../roster-023-review/REQUEST-AND-INPUTS.md#minimum-remaining-owner-inputs-separated-from-code-work) covers ordinary browser/fictional sign-in, bounded role coverage, reviewed media, learning-original retention/withdrawal, review footage/credit policy, recovery and later scheduler approval. Existing prices, USD/per-athlete structure and Elite per-athlete reviews/target turnaround are settled and will not be re-asked. No full product A-grade or live-role/physical-device pass follows from these source fixes.
