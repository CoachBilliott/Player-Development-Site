# Corrected roster probe: test preview published

October 30, 2026, 03:21 UTC. This is a test-tool release, not a production roster release or a hosted-role pass.

- Source: `3ea85dec40e4723d514713ff264939893424fc04` on `test/roster-023-harness`.
- Preview: https://learning-auth-rehearsal.repformed.pages.dev/
- Immutable preview: https://965069fe.repformed.pages.dev/
- Cloudflare deployment: `965069fe-c47c-473a-a70e-a09fa6d8a29f`, success at 03:20:48.869498 UTC.
- One upload through the existing workflow and credential. No infrastructure, permissions, settings, SQL or credentials changed.
- Final local checks: 19 harness unit tests, 28 desktop/phone browser checks, lint, types and isolated build passed. Main application, public files, backend, build scripts and dependencies are identical to the previously validated `6d0975b` source. The previous full application results are historical evidence for unchanged files, not newly rerun checks or hosted acceptance.

## What was corrected

The SQL searches authorized athlete, client, coach, position and workout labels. The original test expected nickname-only matches. In the fictional fixture, `Other` legitimately matches Jordan's assigned coach label as well as Other's nickname. The revised oracle checks every authorized visible field and independently verifies the exact allowed athlete set and scoped total first. It explicitly rejects Coach matching a hidden parent email. Regression tests reject both the old nickname-only behavior and hidden-email disclosure.

The page displays “Search probe version 2”. Failed searches identify a fixed subcheck and only fictional aliases/counts. Timestamped JSON receipts include `toolVersion: roster-search-v2` and fixed results, not tokens, emails, labels or server payloads. Original failed receipts must be retained.

## Current hosted evidence

Parent reports all six normal identities, staff scope, anonymous denial and legacy detail boundaries passed. Owner, Manager and Other Coach paging aggregates failed. Exact rollback passed; identities, counts, grants and old details were preserved. All four learning/scheduler/notices/youth flags are off. Actual failing historical subchecks were not captured, so the precise attribution remains an inference even though the source oracle defect is proven locally.

No corrected hosted rerun has occurred. Production stays `0816c343` / deployment `bab6aa19`, and TestFlight stays build 15.

## Operator handoff: preserve sessions

The existing six tabs retain the old JavaScript bundle and memory-only sessions. Publication does not reload them. **Do not refresh or navigate away just to load this fix.** The old UI has only fixed probes, no equivalent arbitrary migration-023 search/paging control. The training-bank search is a different API and is not equivalent. Do not inject scripts, extract sessions or emulate privileged roles.

A corrected retest requires coordinated ordinary loading and private sign-in, or another genuinely supported existing session path established by the owner/operator. The normal “Refresh verified role” action can use the SDK's ordinary session refresh but does not load new source. Owner asleep is not permission to expose passwords or alter Auth persistence.

When a supported authenticated path is available, only the existing helper executes the previously approved unchanged SQL install and exact rollback. Run scope, paging and detail checks under each permitted actor, save versioned receipts, verify anonymous denial paired with positive staff results, then verify exact rollback and flags off. The unchanged SQL and original approval remain separate from this test-tool correction. No production approval or new role/account mutation is implied.
