# Exact-release audit: website 51841292 and TestFlight 16

Accessible evidence consolidated October 30, 2026. This is a strict partial audit, not an all-role live certificate. **The A+/B+/A− target is not certified.** One new P2 layout defect is confirmed; production permissions, real-device performance and unreleased learning still have material verification/activation gates.

## Verified releases

Website https://repformed.com: source `51841292d0f286fe916155633d39506c742d47e9`, Cloudflare production `448dc0cd-2b6a-41ed-ae0f-5b7d1c57586b`, success 03:50:56 UTC. Provider source/environment/stage verified. Fresh normal-auth artifact and eight affected desktop/phone checks passed. This executor did not perform a fresh public-browser journey because its known frontend restriction remains; independent live web QA is separate.

TestFlight 0.1.0 (16): signed run `41002907123` attempt 2 succeeded. Apple status run `41004145719`, checked 04:40:03 UTC, confirms VALID / IN_BETA_TESTING and explicitly lists 16 in existing Owner Testing. Apple build ID `9c10d60e-fbb4-4052-aa50-c0fee9159bb1`. No new testers or external/public App Store release.

Exact exported IPA: SHA-256 `f794bd059e236602ad81d48a44744142bbac59899e3833648a78eb410c3320d0`, 16,368,248 bytes. Application asset hashes and normal auth/interest config match the released website artifact. The service worker has identical logic and asset set; font-list ordering and the derived cache key differ. No private signing files were found in the IPA. Archive bytes are not installed memory/footprint measurements.

## Completed checks and their limits

| Evidence | Actual result | What it does not prove |
|---|---|---|
| Exact main CI 40998246749 | 378 unit/database, 426 website, 10 app/offline, 6 private-preview, 11 Python; static/functions/build passed | Every real production role or device |
| Exact-source native 40998267444 attempt 2 | Six tests passed; iPhone 17 Pro / iOS Simulator 26.2, Debug; unsigned device archive and evidence upload passed | Physical Release-binary behavior or real Auth workflows |
| Exact signed-IPA web assets, 390×844 | 15 fixture cases passed; seven role presentations; five cold local contexts per role | Native launch/network performance or server authorization |
| Exact signed-IPA web assets, 320×568 | 15 fixture cases passed; three cold local contexts per role; correct 320px overflow threshold | Keyboard/safe-area behavior on an actual small iPhone |
| Automated appearance subset | 26 route views at each width; no detected axe violations or page overflow | Full WCAG certification: incomplete checks and manual/device cases remain |
| New card geometry audit | Owner/Manager passed; assigned/unassigned Coach failed at 320px | This is a real fixture-layout failure, not a hosted permission failure |

Counts are per suite/viewport and are not summed as unique feature coverage. All role fixture traffic was mocked, external requests denied, and records fictional adults. No real account, role, customer record, private file or email was changed. Native functional screenshots were waited-for XCTest attachments and were visually reviewed. The immediate, unwaited post-launch screenshot is blank and is not used as a render or performance pass.

## P2-01: Coach Refresh escapes the roster card at 320px

Expected: the header text and 44px Refresh control stay inside the roster card at all supported widths.

Observed on exact build-16 assets at 320×568, both assigned and unassigned Coach: card right edge = 300px, content right edge = 284px, Refresh right edge = 309.546875px. Page scroll width remains 320px, so the previous page-overflow assertion missed this internal-card defect. Owner/Manager and tested 375/390px variants fit.

Reproduce with the fictional Coach fixture, `?source=app#workspace`, viewport 320×568. Inspect `.staff-service-heading .staff-refresh` relative to `.staff-service`. The “Your assigned athletes” header has insufficient flex room. Exact redacted geometry is in fixture-results/geometry. The new check fails for both Coach cases and is retained. Recommended bounded fix: allow the header to wrap naturally, preserve the touch target and role text, and test refresh/search behavior and header geometry across widths. No permission changes are needed.

No P0/P1 exploit or data-loss failure was observed in the accessible sample; unavailable cases are not evidence that none exists.

## Role and domain assessment

| Role / domain | Observed result | Live acceptance |
|---|---|---|
| Spectator / signed out | Fixture welcome → login → help; no credentials sent; actual native welcome/login screenshots rendered | Public production browser recheck and real recovery delivery not exercised here |
| Owner | Fixture roster/detail/back/account navigation; overdue action priority; 25 visible rows from 1,000 fake records | Production normal-role mutations, data and permissions unverified |
| Manager | Fixture operational navigation and Owner-only administration denial | Production normal-role boundaries unverified |
| Assigned Coach | Fixture scoped presentation, detail/account/training; P2-01 at 320px | Actual production assignment/clip boundaries unverified |
| Unassigned Coach | Fixture empty roster and no unrelated athlete actions; P2-01 at 320px | Existing hosted fixture has no truly unassigned Coach Auth identity |
| Guardian | Fixture selected-profile Today/Workouts/Progress/Account presentation | Real household/sibling/media and recovery acceptance unverified |
| Athlete/adult | Fixture own-profile navigation and work visibility | No standalone Athlete Auth actor in current six-user hosted fixture; production acceptance unverified |
| Appearance/accessibility | All seven role presentations visually sampled; automated subset clean; P2 card overflow found manually/geometry | PARTIAL, not an A-grade or full accessibility pass |
| Performance | Local cold-context diagnostics only; no crash/page errors in those fixture journeys | Physical launch, real-network latency, memory, energy, playback/upload and resume UNVERIFIED |
| Permissions/privacy | Main tests and hosted test-project historical scope/detail negatives provide separate evidence | Production role/data isolation NOT CERTIFIED; never inferred from hidden UI |
| Training delivery/history | Existing manual UI fixture routes work; weekly plans/quiz/library/reminders are green draft source | PR13/21/24 NOT RELEASED or activated; hosted final learning acceptance remains blocked |
| Errors/recovery | Main regression fixtures cover error/cancel/restore paths | Actual reset/invite/withdrawal/media recovery not run; no extra email or account mutation authorized here |

No new overall numerical score is assigned: domain/role coverage does not meet the strict rubric's live/device threshold. A successful fixture average cannot erase blocked security, grading, data-history or critical-delivery cases.

## Actual local performance diagnostics

390px five-context median ready-UI times: signed out 333.7ms; Owner 438.0ms; Manager 446.5ms; Coach 415.3ms; unassigned Coach 422.4ms; Guardian 451.5ms; Athlete 443.6ms. These include browser automation overhead over loopback with fake responses, service workers blocked and reduced motion. They are **not iPhone startup or internet-service metrics**; warm-device and network measurements were not performed.

The 1,000-row fake roster displayed 25 rows/32 buttons. First-page ready was 468ms at 390px and 594ms at 320px; local filter was 40ms/38ms. The legacy client still receives all fixture rows. This does not establish hosted database/network scalability. Server-paged PR21 remains a separate rollout gate.

## Open readiness gates, not grade adjustments

1. Correct P2-01, run required final checks, publish only the tested replacement, then recheck the exact new website/app build.
2. Corrected hosted 023 paging needs the new probe loaded and ordinary authentication. Six old tabs are retained; no equivalent manual inputs exist. Do not extract/transfer tokens or reinstall merely to repeat the known old-probe failure. Original scope/details/anonymous/rollback positives and paging failures remain preserved.
3. Weekly final Auth/Storage/quiz grading/library/history acceptance, exact 022/024 rehearsal approval and production permission/media/recovery approvals remain. No standing Cron, youth, overdue or marketing activation is implied.
4. Actual DB plus private-media restore evidence, reviewed/licensed lesson media and remaining review-footage retention/storage/credit-period policies are not established. USD per athlete, Elite allocation and target three business days are already settled.
5. Physical installation/keyboard/safe areas/camera/playback/upload/offline and authorized production roles need their real acceptance path. No production test accounts/roles or credentials are created by this audit.

The existing public interest/consent/signup notification and approved package terms remain unchanged. Conditional publication covers ordinary tested repairs; security-sensitive activation still requires its exact approval.

## Subsequent independent live public evidence

The parent supplied an actual desktop spectator pass at 05:12–05:14 UTC: compact pause/play operation and keyboard focus, skip-to-main, correct package terms, unchanged consent during plan preselection, help/Escape/focus restoration and privacy/footer navigation worked. No new concrete public regression was observed. See INDEPENDENT-PUBLIC-OBSERVATIONS.md for exact scope. This closes that limited public-observation gap, not mobile/private/native/security coverage or the Coach-card defect. No form was submitted or email sent in the pass.
