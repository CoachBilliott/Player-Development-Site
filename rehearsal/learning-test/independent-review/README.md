# Independent release and schedule review

**Publication update:** PR12 has since been approved, merged and published. See [the final production receipt](PRODUCTION-RELEASE.md). PR13 remains draft/unmerged/off. The original source-only review below is preserved as historical evidence.

October 29, 2026. This assessment is source/local-browser work only. No account reset, credential configuration, hosted migration, feature activation, Cron job, outgoing email or deployment was performed.

## Recommendation: PR12 can ship independently

[PR12](https://github.com/repformed/Player-Development-Site/pull/12), `ux/staff-workflows`, is based directly on current production main `f1e9812dce0fe465d99d5115fddcce16c9796dc2`. Its reviewed source has no backend, migration, public asset, dependency, workflow, homepage, package or interest-form implementation change. It reorganizes existing staff pages and uses existing authorized RPCs. **It does not depend on PR13 or learning migrations019–021.**

PR12 provides Athletes / Training / Staff & settings, assigns from the selected athlete record, keeps sibling context fixed, explains replacement, and separates personal account controls from Owner administration. Owner/Manager service-coach assignment remains intact. Actual training-workout assignment remains Owner-only under existing backend rules; Managers/Coaches do not gain it. Existing protected/legacy routes remain guarded. No additional role, record scope or resource grant is silently enabled.

Recommendation: use PR12 as a small independent usability release if the owner wants the improvement before weekly-learning acceptance finishes. Publication approval is still required; nothing is published by this review. Do not describe that release as automatic plans, groups, quizzes, grades or a paying-youth launch. It retains one current manual saved workout per athlete, up to 12 drills; reassignment replaces that current workout and does not change sibling workouts. Existing progress remains historical. Template edits do not automatically propagate. The roster is still the existing scoped roster, without PR13's server pagination.

PR13 targets PR12's branch and depends on these UI changes. The narrow phone fix was merged into PR13 without rewriting either branch or changing permissions. After any approved PR12 merge, retarget/reconcile PR13 against the new main and verify the combined head before learning publication. Do not merge the learning branch just to obtain simpler navigation.

## Checks and responsive review

On PR12's independent checkout, before the four-line dialog fix:

- Lint, TypeScript and production build passed.
- 50 focused desktop/phone staff-workflow, athlete-assignment, private-workspace and site-chrome checks passed.
- 16 interest-intake checks, 6 isolated fictional-preview checks and 8 compiled app/offline checks passed. These are separate suites, not a full new aggregate run and not real-device acceptance.
- The initial focused dev-server run used a dependency symlink and warned that font files were outside Vite's serving root. Dependencies were installed locally for the subsequent visual/preview/intake/offline runs; no filesystem protection was relaxed. Do not use the initial screenshots as visual evidence.

Local browser review with loaded brand fonts covered Athletes, Training and Staff & settings at 320/375/390 CSS pixels: no page horizontal overflow, no page script errors, and athlete assignment cancellation/back retained context. The long secondary Training navigation intentionally scrolls horizontally on phones; this is a discoverability limitation, not a broken route. No physical phone was used.

The review found an actual phone overlap: scrolling the inline confirmation's Keep current assignment button into view could place it beneath the sticky Back to athletes footer. A scoped dialog scroll-padding rule now reserves space for that footer. Regression assertions test the actual center hit target, not merely DOM visibility. The six affected real-component assignment checks and all six isolated-preview checks passed after the fix. An interrupted preview run had six connection-refused failures when its manually served process stopped; a clean server-owned rerun passed all six. No assertion was removed. Final checks are **green**: PR #12 at `53f7b02`, [CI 40807228178](https://github.com/repformed/Player-Development-Site/actions/runs/40807228178): 375 unit/database, 358 website, 8 compiled app/offline, 6 isolated preview and 11 Python checks. PR #13 at `9c56ec55`, [CI 40807346159](https://github.com/repformed/Player-Development-Site/actions/runs/40807346159): 428 unit/database, 366 website, 8 compiled app/offline, 20 isolated preview and 11 Python checks. Lint, types, Deno and build passed in both. `CHECKS.json` records exact heads and terminal metadata; do not add overlapping local reruns to these totals.

[Fixed phone confirmation](assignment-confirm-phone.png) shows both confirmation choices clear of the return action. [Training at 375px](training-375.png) is the separate library view. Both contain fictional adults only. The saved phone QA JSON predates the overlap fix and establishes page width/context checks, **not** absence of control occlusion; the new hit-target regressions establish that.

## Sunday / Friday / capacity evidence

The existing green PR13 checkpoint was59ac534, CI40776666047:426 unit/database, 366 website, 8 compiled app/offline, 20 isolated preview and 11 Python checks, plus lint/types/Deno/build. The follow-up adds two local PostgreSQL regression tests; the expanded unit/database suite passed428 tests across39 files. Do not add these overlapping totals together.

| Requirement | Concrete local evidence | Remaining hosted/operational gate |
| --- | --- | --- |
| Sunday00:00 America/Chicago | `src/learning/schedule.test.ts` pins March8 06:00Z/March15 05:00Z and November1 05:00Z/November8 06:00Z. SQL tests separately verify `learning_next_sunday`; roster date tests pin Chicago independent of browser zone. | Real hosted tick and release/Storage visibility acceptance; no standing job active. |
| Start and release truth | SQL dry-run creates zero releases. Repeated real local ticks create one release, record scheduled/actual timestamps separately, release only approved matching versions, and advance to the next Sunday without dumping missed weeks. | Confirm hosted actual availability and authenticated learner payload. |
| Friday only, incomplete only | Clock defaults to17:00 Chicago, configurable by Owner. Tests cover summer/winter conversion, no reminder before due/after Friday, completed/inactive/paused/already-notified skips and final released week. New SQL regression checks configured16:30 exactly before/at boundary and paused suppression. | Hosted real-session inbox and a separately approved scheduler; time17:00 is a proposed default, not owner-selected exact time. |
| No repeated reminder flood | SQL tests repeat ticks and assert one Friday notice per release/date, suppress obsolete/current-week and revoked-access notices, and preserve guardian/linked-athlete permissions. | Actual hosted retries/concurrent execution and redacted receipt. No routine client email. |
| Low-content warnings | Consecutive approved/publishable ready weeks, not drafts. Default fewer than2; urgent at0. New SQL regression verifies one warning on repeated ticks, resolution after approval, same-warning reopen with stale read cleared after withdrawal, transition to urgent, and household/unassigned-coach exclusion. | Hosted staff inbox/assignment revocation and test content lifecycle. Current threshold is global, not connected to per-package/client monitoring overrides. |
| Pause, failure and rollback | SQL tests preserve releases/grades on pause/resume/repeat, stale-action rejection, per-enrollment rollback on a forced release error, independent healthy-athlete release, flag-off denial and legacy service response. | Hosted Auth/Storage and provider recovery acceptance; local PostgreSQL is not a verified backup restore. |

The two added tests initially failed because test-fixture code tried to read a raw private table as an authenticated Owner. The fixture now reads its version as the isolated database setup role, then invokes the unchanged authorized Owner RPC. No table grants or access checks were weakened. No product scheduling defect was found in this pass.

## Actual status and blockers

Cloudflare metadata was read through the existing authorized connection during this pass: project `repformed`, branch `main`, production deployment `4e084cca-042b-41c5-806a-1d730239cc68`, source `f1e9812dce0fe465d99d5115fddcce16c9796dc2`, successful. PR12/13 remain unpublished.

The existing isolated test project `ojcfrfpeftvngyluomex` received the approved rehearsal schema through the other browser task. That task reported six fictional login/profile-RLS and private original-lesson upload checks before losing its memory-only passwords. All learning/scheduler/notices/youth flags were then reported off. This pass did not recheck or mutate those hosted records. The owner-run recovery helper is prepared at274d353; completing the remaining real Auth/Storage/quiz/grading/history checks waits for owner laptop sign-in. No new credential or account is required by this assessment.

Local UI fixtures and PostgreSQL tests are not proof of hosted GoTrue JWT handling, actual Storage URL behavior, production load capacity or installed TestFlight readiness. Native build13 is unchanged. Coaching approval of real curriculum, payment entitlements and public youth consent/enrollment remain separate launch gates.

See [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) for the two separate release scopes and rollback requirements.
