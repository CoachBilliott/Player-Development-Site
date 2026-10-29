# Weekly learning validation record

Current status, October 29, 2026: weekly learning remains unpublished. Public production is `6e37d105044310c0881d7618143c58f99863c841` (package presentation release), not the learning preview. Production learning migrations/flags/Cron have not been activated by this task. Records below are dated source checkpoints, not current hosted acceptance. No new native release has been uploaded.

## October 29 readiness remediation

PR13 committed checkpoint `eff2901d55597c462a7de7daf0c8998cea9542c8` passed [CI40902907191](https://github.com/repformed/Player-Development-Site/actions/runs/40902907191): 431 unit/database, 410 website, 10 app/offline, 20 isolated preview, 11 Python plus lint/types/Deno/build. Subsequent migration022 and UI/test changes are not covered by that earlier run; final-head CI is required.

Migration022 addresses the audit finding that an approved quiz-only week could count as ready. It enforces the official additive weekly counts and distinct lesson/quiz pairing, with detailed missing-item status and guarded staff save/approval. It is not installed in the hosted test or production project. Local PostgreSQL emulation is not hosted Auth/Storage acceptance.

The existing isolated test project is `ojcfrfpeftvngyluomex`; all four learning/scheduler/notices/youth flags were verified OFF by the authorized dashboard worker at12:21UTC. Interrupted quiz upload persisted zero quizzes, versions, attempts, grades or enrollments. Ordinary harness navigation most recently failed with ERR_QUIC_PROTOCOL_ERROR at14:51UTC. Earlier six-user sign-in/profile/private-upload observations do not certify current sessions or the unfinished quiz/enrollment/grading/library tests. No connection/protection/credential bypass is permitted.

Production recovery evidence and exact019–022 permission/media-retention review remain release gates. Existing six fictional users require secure ordinary sign-in/recovery; a seventh standalone athlete has not been created or approved. No live role audit, physical iPhone acceptance, marketing send or payment activation is claimed.


## Previous complete green checkpoint

PR13 at `251863a0c0be163621c6ac0a16d643cf64814057`: [CI40764930788](https://github.com/repformed/Player-Development-Site/actions/runs/40764930788) SUCCESS:415 unit/database,362 website browser,8 compiled app/offline and12 isolated preview tests,11 Python checks, lint/types/Deno/build. These are the actual final counts for that revision, not totals to add to subsequent overlapping reruns.

The earlier05a full run failed four obsolete Sunday-copy/FAQ-count assertions; exact assertions were corrected without removing coverage. Earlier environment-interrupted runs and shared-output trace errors were not counted as passes. The later green run above supersedes them.

## Current workflow completion pass

Implemented on top of251:

- Weekly roster/service summary with athlete-context enrollment, grading and pause/readiness actions. Legacy workout assignment is advanced-only when weekly mode is active.
- Keyset-paged server search/filters and scoped summary counts; default25/max100 rows. Group selection keeps choices across pages, edits saved groups, previews new/kept/blocked enrollments and preserves prior progress/pauses/grades.
- Actionable staff capacity notices with athlete name and next due time; immutable quiz re-import version picker; distinct Today/Library/Progress shared website/app views; selected household athlete restored from per-user session state.
- Conditional weekly help with templates, contact and five social links; historical partner guide prominently links the new instructions.
- Draft021 adds no public table reads, role grants, scheduler or email. Review [ROLLOUT-REVIEW.md](ROLLOUT-REVIEW.md) for019–021 permissions and activation gates.

Completed local checks on this pass:

- 426 unit/database checks,39 files; includes27 isolated PostgreSQL learning-policy tests,12 import tests,8 schedule/DST tests and4 weekly-service presentation tests.
- 11 Python checks; lint, types, Deno Edge Function checks and production build pass.
- 8 enabled-feature app-route checks across desktop/phone cover selected athlete, no trusted client grade, current/library/progress navigation and stable server-backed group picker. These use synthetic fixtures, not live Auth.
- 20 isolated desktop/phone preview checks passed including roster/help accessibility, screenshot capture and explicit midnight display assertion. Full website/app and final CI results are recorded in the PR checks/task receipt when terminal. No uncompleted run is a pass.

The group-picker refresh-loop regression was fixed by keeping default profile arrays stable; selecting/canceling group choices does not refetch the server page. An added route check initially expected a relative help URL while the Vite development base correctly rendered an absolute-root path; corrected exact URL assertions passed without weakening navigation coverage.

## Evidence and limitations

GitHub Actions uploads `learning-review-evidence` with original CSV templates and fictional learning PNGs after tests. This is a GitHub artifact, not a Library attachment; no Library publisher is available in this task. Counts/dimensions/ZIP hash must be taken from the artifact belonging to the final head.

The walkthrough uses real UI components with a browser-local fake transport, explicit fictional adults and no real media. Its grading, timing, enrollments and role changes are simulated. The separate PostgreSQL tests exercise actual draft RPCs, role/household/coach access, immutable scoring/history, release retry/rollback, DST, reminder dedup, group atomicity and153-row paging. This is correctness evidence, not production-load testing.

Read-only hosted inventory at21:35UTC found production only, zero branches, no learning schema or pg_cron, zero listed provider backups, PITR off and WAL on. A schema-function/policy metadata snapshot is saved outside the repository, but is not a customer-data backup or tested restore point. No target was provisioned or modified. Hosted real Auth/Storage/restore rehearsal remains required before permission migration; see the rollout review for exact staged approval.

Public browser QA from this worker is limited by the known Cloudflare1010 client restriction; no bypass or redundant requests are used. Cloudflare deployment metadata and local browser checks can verify preview provenance/isolation; independent public QA is separate. Installed iPhone build13 remains unchanged; compiled app/offline tests are not physical-device acceptance. No payment integration, finished curriculum, qualified coaching approval or public youth readiness is claimed.

Visual review found a roster-only date formatting defect: the source instant was correct but the browser-local formatter was labeled Central. Weekly roster dates now explicitly use America/Chicago; tests pin midnight immediately before and after the November DST change. Other legacy review dates keep their existing browser-local semantics. See [ACCEPTANCE-MATRIX.md](ACCEPTANCE-MATRIX.md) for the cross-site route/role map.

The local full website run completed365 passes/1 failure: the new Owner route test read its request-capture array immediately after a static panel heading appeared, before the asynchronous athlete RPC began. The assertion now polls for the same exact selected-athlete ID; no endpoint/access assertion or product behavior was removed. All8 affected desktop/phone route checks passed after that synchronization correction. A complete final-head CI rerun remains authoritative; the interrupted/superseded/failed local runs are not reported as green.

### Package-completeness local final checks (October29)

022 source pass:453 unit/database tests, lint, TypeScript and production build passed. The focused learning route suite passed12 desktop/phone cases; isolated fictional preview passed20 cases. These overlap aggregate suites. The first new UI tests used an overly strict label selector; role-based combobox selectors fixed them without changing product/access assertions. An existing household test raced the asynchronous request capture; it now polls for the same exact selected profile before continuing. Final aggregate hosted CI is still required on the pushed head. No hosted Supabase mutation or real notification was performed.
