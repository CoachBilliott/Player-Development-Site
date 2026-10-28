# Weekly learning validation record

October 28, 2026. All new learning work is unpublished source and an isolated fictional preview. Production remains `f1e9812dce0fe465d99d5115fddcce16c9796dc2`; no learning migration, role grant, real enrollment, email, scheduler or native release has been applied.

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
