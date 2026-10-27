# Unpublished review-preparation slice

Local checks on 2026-10-27:

- Lint, TypeScript and build passed.
- 19 focused unit/database tests passed: three new clip-selection cases plus the existing grouped-review preview and fulfillment policy suites.
- Four desktop/phone grouped-review browser cases passed after installing this worktree's own dependencies (no font serving failures). These exercise partial upload/retry/refresh, one deadline/response, cancellation, explicit deletion and finite storage. An earlier run with symlinked dependencies had font-serving warnings and is not the final layout result.

Changes: one shared clip-selection validator rejects invalid metadata or unknown/insufficient storage before reserving a review; existing 60-second clips/180-second total/three-clip bounds remain. Obsolete four-monthly-review examples are removed; two complete three-clip reviews explicitly do not fit the current five-space account cap.

This branch is source preparation only. No migration, service activation, paid allowance, feedback archive, quota/retention/security change, production deploy or native upload is included. Current delete actions still remove attached feedback; the retained-feedback contract is a proposal requiring further implementation and approval. No server media-duration verification is claimed. See README.md and FEEDBACK-CONTRACT.md for exact remaining gates.
