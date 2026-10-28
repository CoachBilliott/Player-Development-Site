# Validation checkpoint — weekly learning draft

October 28, 2026. Source is staged only; production remains f1e9812. No migration, new access flag, scheduler, email recipient, role, real customer enrollment or native release changed.

Completed:

- PR12 inline athlete assignment source 2f3879657dd1c8b642581a4c9cbca83687c4013a: CI40754987514 SUCCESS. Preview deployment1e2cf7eb-a447-4175-aaf7-f5734de88956 verified through Cloudflare API. This is separate from the new learning draft.
- First aggregate learning unit/database pass: 412 passed, 38 files. Later core-policy reruns: 37 passed (17 PostgreSQL integration +12 CSV import +8 schedule tests). Current resumed lint/type/core checks passed. Later full CI is still required for final head.
- Preview browser pass: 12 passed across desktop/phone, covering existing workspace safeguards plus CSV import errors/review/save, quiz draft resume, inside-site submission, staff written grading, retained grade after simulated Sunday, Friday notice/read/reset, scope denial, no external requests and phone overflow. Final preview rerun follows environment interruption.
- Enabled-feature app-route integration: 4 passed (Owner athlete-context plan + quiz import; household selected-profile draft endpoint + no client score field; desktop/phone). Uses synthetic fixtures, not live Auth/service acceptance.
- Lint, types, production build, Deno checks passed. Correct Python suite: 11 passed (`python3 -m unittest discover -s scripts/tests`). An earlier wrong-directory discovery ran zero and is not counted.

Interrupted / not green:

- Full website browser run started with358 tests, interrupted by environment restart after desktop progress around177 tests; it has NO terminal result. Separately launched browser tests initially shared `test-results` and caused ENOENT trace errors in some full-suite tests. This was a test orchestration mistake, not waived product failures. Subsequent focused integration used an isolated output directory and passed. Run the full suite cleanly with one writer before release.
- A first preview pass found a missing landmark on the new preview link and a draft-save UI refresh bug. Both fixed; subsequent12-preview pass green. A later final preview pass was interrupted during restart and is not counted complete.
- Native offline/app suite has not yet run on the final learning source. Installed iPhone build13 is unchanged. No native/device acceptance claimed.
- No hosted migration/Storage rehearsal, real scheduler job, Google OAuth/Sheet creation, payment integration or curriculum review performed.

Artifacts/logs are under `/workspace/.player-development-setup/learning-*` and ignored `artifacts/private-workspace/learning-*`. Browser screenshots use fictional records only. The interactive walkthrough is an explicitly local simulation; PostgreSQL policy tests separately exercise the real draft RPCs. Public URL verification from this worker remains blocked by the previously observed Cloudflare1010 client restriction; only supported management API and local browser checks are used.

## Counter/gradebook review

Added direct group-gradebook role/score coverage and a forced downstream release failure. The latter found that PL/pgSQL counters survived the failed athlete's subtransaction and could overstate successful releases. Counters now restore on that rollback; another athlete's successful release remains committed. Focused core:39 passed (19 PostgreSQL,12 import,8 schedule); full unit/database:414 passed. Lint/type checks passed. No production change. Final aggregate/browser/offline/preview checks must be terminal on the final PR13 head; consult its GitHub checks rather than treating earlier overlapping totals as additional tests.

The existing GitHub Actions workflow now uploads `learning-review-evidence` containing the two CSV templates and six fictional learning screenshots after browser checks. This is a GitHub artifact, not a Library attachment. No Library publishing tool is exposed in this task, so no Library IDs have been invented. The isolated preview is frontend05a7ef5; the later counter fix changes backend logic/tests and evidence packaging, not that frontend.


## Aggregate follow-up

CI40762299736 at05a7ef5 completed with358 browser passes and4 failures: desktop/phone expectations for the intentionally replaced Sunday wording and the FAQ count (9→10). Those two exact assertions are updated without removing coverage. The intermediate6bbf57e run was superseded by this correction. Local compiled app/offline suite passed8 checks. Final CI must run all362 website,8 app/offline and12 preview checks together on the final head; no interrupted or earlier overlapping counts are summed.
