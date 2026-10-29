# Conditional release readiness and live audit

**Staff cleanup is live. Weekly learning is prepared and tested, not activated.**

- Production: `5491236a05b4e655243bd7ea0f24f513eea47b3e`, Cloudflare deployment `ca16c62f-4497-4364-b656-462005cc6c45`, [repformed.com](https://repformed.com/). [Current UI corrections, CI and screenshots](../public-audit-followups/README-UI-CORRECTIONS.md). Production auth/intake configuration and all public static assets are unchanged.
- PR13 is reconciled with that main at `71be2f05e3d734697e38b9c89e4bfdf43f59ee34`, preserving the same intake/PWA corrections. Backend/migration source is unchanged. [CI 40822694355](https://github.com/repformed/Player-Development-Site/actions/runs/40822694355) passed: 428 unit/database, 376 website, 10 compiled-web-app/offline, 20 fictional-preview and 11 Python tests, plus lint/types/Deno/build. These overlap prior/local results and must not be summed. The PR remains draft/unmerged, and production learning is not activated.
- The owner's conditional publication instruction is recorded. Once its conditions and exact security-action approvals are satisfied, ordinary website publication need not be requested again. It does not authorize silently changing production permissions or standing jobs.
- **Actual live anonymous API audit:** one public control passed, then all ten private table/RPC reads returned explicit 401/42501 permission denial. No account mutation, email, payload dump, row/identity/token/signed-URL retention or frontend restriction bypass. [Redacted actual receipt](LIVE-ANONYMOUS-API.json). This is not a full browser/role/Storage/new-learning audit.

## Remaining gates, not failed runtime claims

| Priority/type | Verified finding | Next bounded step |
| --- | --- | --- |
| Release blocker | Fresh production metadata: learning schema/Cron absent; zero listed provider backups, PITR off, no usable recovery evidence. Function/policy snapshot is metadata only. | Establish supported secure owner-controlled recovery and restore evidence before production schema. No paid recovery service or data export without its specific scope approval. |
| Security-action approval | 019–021 private learning data/RPCs, erasure integration, original-media read/retention policies and service wrapper are not yet approved for production. | Review exact migration hashes/permissions and retention choice after hosted acceptance; do not infer permission from test-project approval. |
| Hosted acceptance / cleanup blocker | Six guarded sessions and the existing two-week plan were verified. Quiz creation, enrollment, grading and release are unconfirmed. Browser disconnected; upload chooser transport closed with uncertain outcome. Test learning was last verified enabled, and disabling it is unconfirmed after a permission denial; other test flags were last verified off. | Restore the authorized browser or obtain fresh relevant permission context, inspect uncertain upload, then complete acceptance and confirm flags off. Do not bypass the denied cleanup through another connector or credential. Production remains untouched. |
| Live role coverage | Required non-Owner/household actors are unavailable for full coverage in current inventory. Management counts are not role-session proof; detailed business counts stay private. | Approved existing sessions/controlled records or a separately approved minimal production fixture setup. Never impersonate or repurpose a real family. |
| Product scope | New learning Friday time/ready threshold are global, not linked to package/client overrides. | Complete integration or explicitly accept its bounded initial scope; do not advertise nonexistent customization. |
| Browser/device limitation | Coding worker has no live browser session and known Cloudflare 1010 frontend restriction. Native build 13 unchanged. | Parent's supported desktop browser performs actual signed-out and authenticated cases; native acceptance remains separate. |

The phone overlap found in the earlier staff review is already fixed and deployed. No new private-data exposure was observed in the bounded anonymous API probes; untested surfaces remain unproven.

## Handoff documents

- [Exact approvals, recovery and staged rollback](APPROVALS-AND-RECOVERY.md).
- [Live audit execution, actor setup proposal and parent/desktop handoff](LIVE-AUDIT.md).
- [25 case audit matrix](LIVE-AUDIT-CASES.csv): passed, blocked and not-run are explicit.
- [Immutable source/migration hashes, terminal CI and metadata](READINESS.json).

The original preparation/audit did not change production learning data, permissions or flags. Separate approved copy and intake/PWA corrections are recorded in [the follow-up receipts](../public-audit-followups/README-UI-CORRECTIONS.md). No role/account creation, password reset, credential configuration, migration, flag/Cron/email activation, paid/youth enrollment or native release occurred. Production serves the approved staff cleanup plus those bounded public UI corrections; no learning activation occurred.
