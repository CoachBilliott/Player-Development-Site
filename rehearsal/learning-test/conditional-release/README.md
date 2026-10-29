# Conditional release readiness and live audit

**Staff cleanup is live. Weekly learning is prepared and tested, not activated.**

- Production: `a58bd829ea128e39426a8e630bc35b37999581b3`, Cloudflare deployment `cccba94e-f378-47e8-9a67-392969a4b60a`, [repformed.com](https://repformed.com/). [PR12/main release receipt](../independent-review/PRODUCTION-RELEASE.md) records terminal green checks and preserved auth/intake/permissions.
- PR13 is reconciled with published main and now targets main at `e4f025094f4696858639be71753891d052318415`. The application tree is identical to previously green `9c56ec55`. [CI 40812285119](https://github.com/repformed/Player-Development-Site/actions/runs/40812285119) passed: 428 unit/database, 366 website, 8 compiled app/offline, 20 isolated preview and 11 Python checks; lint/types/Deno/build also passed. These overlap older/local results and must not be summed. The PR remains draft/unmerged.
- The owner's conditional publication instruction is recorded. Once its conditions and exact security-action approvals are satisfied, ordinary website publication need not be requested again. It does not authorize silently changing production permissions or standing jobs.
- **Actual live anonymous API audit:** one public control passed, then all ten private table/RPC reads returned explicit 401/42501 permission denial. No account mutation, email, payload dump, row/identity/token/signed-URL retention or frontend restriction bypass. [Redacted actual receipt](LIVE-ANONYMOUS-API.json). This is not a full browser/role/Storage/new-learning audit.

## Remaining gates, not failed runtime claims

| Priority/type | Verified finding | Next bounded step |
| --- | --- | --- |
| Release blocker | Fresh production metadata: learning schema/Cron absent; zero listed provider backups, PITR off, no usable recovery evidence. Function/policy snapshot is metadata only. | Establish supported secure owner-controlled recovery and restore evidence before production schema. No paid recovery service or data export without its specific scope approval. |
| Security-action approval | 019–021 private learning data/RPCs, erasure integration, original-media read/retention policies and service wrapper are not yet approved for production. | Review exact migration hashes/permissions and retention choice after hosted acceptance; do not infer permission from test-project approval. |
| Hosted acceptance | Desktop outcomes for actual Auth/Storage/quiz/grading/history are pending; six test identities/history remain preserved. | Parent coordinates existing desktop task and receives redacted results; keep isolated test flags off afterward. No password/credential workaround. |
| Live role coverage | Required non-Owner/household actors are unavailable for full coverage in current inventory. Management counts are not role-session proof; detailed business counts stay private. | Approved existing sessions/controlled records or a separately approved minimal production fixture setup. Never impersonate or repurpose a real family. |
| Product scope | New learning Friday time/ready threshold are global, not linked to package/client overrides. | Complete integration or explicitly accept its bounded initial scope; do not advertise nonexistent customization. |
| Browser/device limitation | Coding worker has no live browser session and known Cloudflare 1010 frontend restriction. Native build 13 unchanged. | Parent's supported desktop browser performs actual signed-out and authenticated cases; native acceptance remains separate. |

The phone overlap found in the earlier staff review is already fixed and deployed. No new private-data exposure was observed in the bounded anonymous API probes; untested surfaces remain unproven.

## Handoff documents

- [Exact approvals, recovery and staged rollback](APPROVALS-AND-RECOVERY.md).
- [Live audit execution, actor setup proposal and parent/desktop handoff](LIVE-AUDIT.md).
- [25 case audit matrix](LIVE-AUDIT-CASES.csv): passed, blocked and not-run are explicit.
- [Immutable source/migration hashes, terminal CI and metadata](READINESS.json).

No production change was made in this preparation/audit pass. No role/account creation, password reset, credential configuration, migration, flag/Cron/email activation, paid/youth enrollment or native release occurred. Production still serves the previously approved staff cleanup.
