# Public hero fix: production release receipt

Published October 30, 2026 at 03:50:56.678187 UTC through one existing Cloudflare Direct Upload attempt.

- Website: https://repformed.com
- Immutable deployment: https://448dc0cd.repformed.pages.dev
- Production deployment: `448dc0cd-2b6a-41ed-ae0f-5b7d1c57586b`.
- Exact merged source: `51841292d0f286fe916155633d39506c742d47e9`, PR #23.
- Provider canonical-deployment metadata independently read back: production, source and completed deploy stage matched.
- Fresh normal-auth artifact: 72 files; entry `assets/index-Dx3RR7Rj.js`. Config SHA-256 remains `bce7ca9fc4b5806db2b10d51e0ef06a04c455bf36d145d331409bb94b0f1c39c`.

The prominent text Pause button has been replaced with a compact 44px icon control outside the hero copy. Accessible naming, keyboard pause/resume, focus and static reduced-motion behavior remain. Branding, packages, homepage copy, roles, intake/consent and backend settings were not changed.

## Actual completed validation

Exact main [CI 40998246749](https://github.com/repformed/Player-Development-Site/actions/runs/40998246749) passed all required stages: 378 unit/database, 426 website browser, 10 app/offline, 6 private-preview, 11 Python, lint, types, all three Deno function checks and build. These are per-suite counts, not overlapping sums. The branch CI passed earlier on the identical tree; it is not added to the main counts.

Eight affected desktop/phone smoke checks also passed against the freshly built production artifact, including 320/375/390/768px touch size/separation/overflow, keyboard operation, skip navigation and privacy return. Screenshots in ../hero-control-review are local rendered evidence, not a new production-browser or physical-iPhone audit.

This executor has no supported live browser tool and its known frontend restriction was not retried or bypassed. Independent live public browser confirmation remains to be recorded. Provider metadata plus exact local artifact prove publication provenance, not every live role's behavior.

## Native and deferred features

TestFlight remains 0.1.0 (15) until a new exact-main signed upload and Apple processing are actually confirmed. Exact-main unsigned simulator/device validation 40998267444 is running. The same-tree branch native validation 40997122054 passed, but does not replace the exact-main distribution guard. Read-only Apple preflight 40998571688 confirmed build 16 was unused and existing internal Owner Testing has all-build access. No credentials, group settings or invitations changed.

No migration, permissions, roles, flags, scheduler, routine messages, child enrollment, payment or PR #13/#21/#22/#24 activation was included. Previous production artifact 0816c343 is retained for static rollback. No DB rollback is necessary or implied by this public-only change.
