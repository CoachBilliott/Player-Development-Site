# Service and weekly-learning integration candidate

Prepared October 30, 2026. This source-only candidate combines PR #13 (`1e2269f`) and PR #21 (`d791232`). It does not apply migrations, change roles or credentials, enable flags, schedule jobs, send emails, deploy production, or update TestFlight. The existing desktop helper owns the hosted rehearsal.

## Integration repairs

Both branches changed the same dashboard. Weekly mode now selects the migration 021 cursor API even when manual server paging is also enabled. With learning off, the manual flag selects migration 023 numeric pages. Delivery settings retain the existing full scoped profile list. With both flags off, the legacy workflow remains available.

The reconciled component preserves separate numeric and cursor navigation, selected-athlete detail/back context, weekly enrollment and grades, and Owner-only preference controls. Paged reads share cancellation and a 15-second timeout. Stale actor, role, connection and page contexts cannot supply another context's displayed records. Missing weekly capability fails visibly; only the explicitly reviewed missing-023 case may use legacy compatibility.

An unchanged initial filter and a search cleared before debounce no longer cause a duplicate weekly query or leave Refresh disabled. These are source integration/performance repairs, not new permissions.

No permission SQL was edited. Migration 023 and rollback retain their exact approved hashes. Migrations 019–022 and 024 retain the PR #13 source. The local database fixture now loads them together to test both read paths and the existing wrapped service-detail function. No numbered-migration glob is introduced.

## Separate release candidates

| Candidate | Independence | Required remaining gate |
|---|---|---|
| Released website and TestFlight 15 | Current source `0816c343` | Preserve homepage, packages, intake, consent, shared-inbox email and existing access |
| Public hero control | No roster or learning dependency | Final exact-head checks and ordinary website release verification |
| Manual server paging, PR #21 | Requires existing migration 015 helpers; no learning dependency | Corrected hosted 023 acceptance, production preflight/rollback review, exact production RPC/index/flag approval |
| Weekly learning, PR #13 plus this candidate | Uses learning-aware 021 API; interoperates with manual paging | Hosted Auth/Storage/quiz/library acceptance; separate 022/024 test approval; exact production permission/media/erasure/recovery approval |
| Fictional sample, PR #22 | No migration 023 or learning activation dependency | Source is green and preview exists; reviewed media and lesson-text approval remain unestablished |
| Next native build | Depends on the accepted product slice | Existing signed workflow, exact-build validation and honest physical-device/role limits |

The source of the sample is honest about its missing videos and draft text. Do not describe it as reviewed coaching or a delivered package. Its code has no backend dependency, but a more complete product demonstration still needs real approved assets.

## Acceptance checklist

- Both flags true: weekly API only. Manual flag true and weekly false: numeric API. Settings: full existing scoped choices. No duplicate pager or selected-athlete loss.
- Debounce, cancellation, stale responses, invalid flags, role/connection changes, loading, error, empty, retry and back/focus remain scoped. Owner/Manager metadata and assigned-Coach restrictions remain existing policy; configuration stays Owner-only.
- Real role results come from the existing helper. Both current Coach fixtures are assigned. Unassigned-Coach, role/assignment mutation and large hosted datasets require their own approved bounds.
- Package readiness requires two IQ lessons with linked quizzes; Fundamentals adds two movement sessions; Position/Elite add two additional position drills. Versions and historical grades remain immutable.
- No activation without actual recovery evidence and exact security approval. Migration 024 is not covered by approval for migration 023. Standing scheduling, notices, youth and payments stay off.
- Review storage, footage retention, expiry and credit-period policies remain undecided. Settled USD-per-athlete prices, Elite allocation and target three-business-day turnaround are unchanged.

## Current evidence

Local integration checks passed 62 desktop/phone cases and 58 combined API/database cases. They include the actual draft SQL 023 beside 019–022/024 in PGlite. This confirms permitted coach/client label matching and hidden-client-email exclusion, but local claims are not hosted Auth evidence. Final aggregate CI on the committed candidate remains required.

The parent reports six normal-role scope/detail checks and anonymous denial passed in the initial hosted 023 rehearsal. Exact rollback preserved legacy detail access, identities, counts and grants, and all four flags are off. Owner, Manager and Other Coach paging aggregates failed. The old probe assumed nickname-only matches; the actual failing hosted subcheck was not captured. Preserve those failed receipts. A corrected probe must establish final acceptance; no production approval follows from a source explanation.
