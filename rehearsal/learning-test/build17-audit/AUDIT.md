# Exact-release audit: website 70052ad3 and TestFlight 17

Consolidated October 30, 2026, after Apple processing. **The known Coach-card defect is repaired in the released source and passes the exact exported-app regression. The whole-product A+/B+/A− target is not certified.** Physical-device and normal production-role evidence remain incomplete. Weekly learning and server paging remain unactivated drafts, not failed production features.

## Published and distributed targets

- Website: https://repformed.com, source `70052ad3ea4de0fc42beac53bb0138f640d7bd8c`, Cloudflare production `3a46672b-b999-4d10-a1da-a674028ff754`, successful at **05:23:21 UTC**. Normal authentication, interest intake, consent, existing signup email and package terms were preserved.
- App: **0.1.0 (17)**, same source. Signed workflow [41010880664](https://github.com/repformed/Player-Development-Site/actions/runs/41010880664), attempt 1, passed export, validation, upload, artifact preservation and signing-material cleanup at **05:58:09 UTC**.
- Apple read-only status [41011715032](https://github.com/repformed/Player-Development-Site/actions/runs/41011715032), checked **06:02:13 UTC**, confirms build ID `e46dceaa-762e-4831-bac9-236325c3a78e`, **VALID / IN_BETA_TESTING**, explicitly included in existing **Owner Testing**. No new testers or external/public App Store release. Availability does not prove installation.
- Exported IPA SHA-256: `39d0df3309292d9569160a3176edd438e70652281c44f37676817644a6aaaf58`, 16,368,251 bytes. All critical application assets and configuration match the website artifact. Service-worker logic and asset set match; font-list order and its derived cache digest differ. No private signing files were found. Archive size is not installed memory or disk usage.
- Configuration SHA-256 remains `bce7ca9fc4b5806db2b10d51e0ef06a04c455bf36d145d331409bb94b0f1c39c`. Public registration and weekly learning remain disabled. No database, role, credential, security, scheduler, notification-routing or retention change occurred in this release.

Full machine-readable evidence: [RELEASE-RECEIPT.json](RELEASE-RECEIPT.json), [apple-status.json](apple-status.json), [ipa-static-audit.json](ipa-static-audit.json). The first Apple check did not list 17; it was retained separately. No duplicate upload was used to resolve processing.

## Completed validation, with evidence classes

| Check | Actual result | Limit |
|---|---|---|
| Exact-main CI 41006659216 | 378 unit/database, 434 website, 10 app/offline, 6 private-preview, 11 Python; lint/types/functions/build passed | Source/fixture regression, not all live roles |
| Exact-source native 41006712872 attempt 2 | Six passed, zero failed/skipped; iPhone 17 Pro / iOS Simulator 26.2, Debug; unsigned device archive and artifact upload passed | Simulator and archive validation, not physical Release behavior. First attempt failed runner DNS before tests; normal failed-job retry succeeded |
| Exact exported-app assets, 390×844 | 15 fixture cases passed; seven role presentations; five cold contexts each | Local Chromium app mode, fake backend, reduced motion, service workers blocked, external requests denied |
| Exact exported-app assets, 320×568 | 15 fixture cases passed; three cold contexts each | Same fixture limits; not actual keyboard/safe areas on an iPhone |
| Appearance/accessibility subset | 26 route views at each width, zero detected axe violations/page overflow; 31 incomplete checks at each width retained | Not full WCAG or screen-reader certification |
| Original defect geometry retest | Four staff-role cases passed at 320/375/390px, including assigned and unassigned Coach | Exact IPA browser rendering, not a normal hosted role or physical device |
| Visual review | All seven 390px role presentations sampled, Coach 320px, native-source waited-for welcome/login attachments | Fixture screenshots and source Debug simulator attachments, not physical signed-binary use |

Counts are per suite/viewport, not summed as unique feature coverage. No real account, child, role, record, file or email was changed. Logs and fictional-only JSON are retained alongside this report. Immediate unwaited simulator launch images were not treated as render/performance passes.

## P2-01 closure: Refresh fits inside the Coach card

The previous Build-16 report and failures remain preserved. At 320px the old Refresh right edge was 309.55px while card content ended at 284px. Page-level overflow was false, so the extra card-bounds assertion was necessary.

PR25 allows the heading row to wrap. On exact Build-17 assets, assigned and unassigned Coach now have Refresh bounds **37–134.16px**, inside content **36–284px**, with a **44px** height. Owner and Manager also pass. All four cases pass at 375/390px. The control remains usable and its action/role restrictions are unchanged. Eight source-level responsive/interaction cases and the final aggregate gates passed before release.

Status: **fixed and distributed; exact-artifact regression passed**. Actual physical Coach-screen acceptance remains unverified. This does not retroactively turn the Build-16 failed receipts into passes.

## Role, task complexity and honest coverage

| Role | Exercised on exact IPA assets with fictional fixtures | Actual production-role status |
|---|---|---|
| Spectator | Welcome → login → help in two clicks; help and heading do not overlap; no credentials sent | Independent live public desktop evidence is separate; recovery delivery and physical app unverified |
| Owner | Athletes / Training / Staff / Account; athlete detail opens in one click with focus inside dialog; back and account work; assignment action is Owner-only | Normal production mutations and private data boundaries unverified |
| Manager | Same operational navigation/detail; no Owner workout action; direct Owner administration denied in fixture | All-client service and coach-assignment policy preserved; normal live acceptance unverified |
| Assigned Coach | Assigned roster/detail/account; no Owner administration; overdue review remains primary action; repaired narrow header | Normal live assignment/clip access unverified |
| Unassigned Coach | Empty roster, no unrelated athlete action; Owner administration denied; repaired header | No truly unassigned Coach Auth actor in the existing hosted six-user fixture |
| Guardian | Selected-athlete context; Today / Workouts / Progress / Account; family labels | Real household/sibling/media acceptance unverified |
| Athlete/adult | Own-profile labels and navigation; honest empty assigned-training state | No separate Athlete Auth identity in existing hosted fixture; real completion/resume unverified |

These fixture journeys do not certify server authorization, role changes, actual password recovery or invite delivery. The detail-to-account path recorded three clicks including opening and closing detail; it is not three clicks from the landing page to Account. See [ROLE-DOMAIN-STATUS.csv](ROLE-DOMAIN-STATUS.csv) for explicit partial/unverified/not-released domain statuses.

No additional concrete P0/P1 or P2 regression was observed in this accessible sample. That statement is not evidence that inaccessible cases are safe. Minor pluralization remains visible in one-record roster labels (for example, “1 athletes”); it is a P3 copy issue, not a permission or task failure, and is not hidden by the passing layout checks.

## Performance measurements: local diagnostics only

390px median ready-UI times from five cold browser contexts: signed out 360.9ms; Owner 467.2ms; Manager 443.8ms; Coach 388.9ms; unassigned Coach 391.6ms; Guardian 439.6ms; Athlete 440.5ms. At 320px, three-context medians ranged from 345.3 to 474.3ms.

The 1,000-fictional-row probe displayed 25 rows/32 buttons. At 390px first-page ready took 616ms and local filtering 52ms; at 320px, 521ms and 25ms. This is loopback Chromium with mocked responses and automation overhead. The production legacy path still receives all rows. These numbers do **not** prove hosted scalability or native launch/network performance, and they are not a before/after speed claim. Warm starts, memory/energy, real playback/upload and physical background/resume were not measured.

## Release boundaries and remaining gates

1. **Corrected hosted roster acceptance:** unchanged 023 was rolled back successfully. Historical role scope, anonymous denial and legacy details passed; old paging aggregates failed. The original oracle assumed nickname-only search, overlooking authorized coach labels. The corrected test tool is published, but retained tabs still run the old JavaScript. No equivalent manual search controls exist. Loading the correction requires coordinated ordinary private authentication; no session/token extraction, injection, persistence change or repeat old-probe execution is permitted. The existing operator owns the approved retest. No production 023 permission/index/flag activation is approved by the test-only approval.
2. **Weekly learning:** PR13 and combined PR24 remain draft/off. Completeness, versioned releases, quiz import/scoring/history, Friday reminders, staff capacity alerts, sibling preference rules and paging integration have green source checks. The combined final head `18176fd` passed 487 unit/database, 496 website, 10 app/offline, 20 private-preview, 11 Python plus static/functions/build. These are not hosted acceptance. Test 019–021 exists; 022/024 rehearsal and exact production security/scheduler/backup gates remain separate.
3. **Hosted learning journey:** real Auth/Storage → approved package-complete week → enrollment/release → quiz submission/server score/written grade → next-week library/history → pause/retry/reminder/isolation and rollback are not fully accepted. Existing six actors also cannot stand in for an unassigned Coach or standalone Athlete actor without a separately approved fixture.
4. **Recovery and product policy:** usable production database plus private-media restoration evidence, reviewed/licensed lesson media and remaining footage retention/storage/credit-period/rollover/refund/expiry decisions are not established. Pricing unit, per-athlete Elite allowance and three-business-day target are already settled; they need no redundant decision.
5. **Physical and production roles:** install 17 on an identified iPhone, verify build, safe areas, keyboard, actual navigation/performance, playback/upload/offline/resume and authorized live-role boundaries. No real customers or child profiles are created for this report.

The same disconnected fictional workflow preview is refreshed at https://private-workspace-ux.repformed.pages.dev/#weekly-demo, source `18176fd`, deployment `8798e8e8`. Its network is disconnected and it is labeled fictional. It is not a fulfilled training package. The separate sample-learning draft has no qualified-reviewed video evidence; it is not promoted as product proof.

## Strict grading conclusion

**Interface repair: passed the specified regression and released. Full product: PARTIAL / NOT CERTIFIED.** No overall numerical score is assigned because critical normal-role, hosted delivery/recovery and physical-device cases do not meet the rubric's coverage threshold. No average of fixture results can turn missing security, trusted grading, retained history or restore evidence into a launch-ready grade. Paid enrollment, junior media and unfinished automation remain closed/off.

Independent public spectator observations from 05:12–05:14 UTC cover compact motion control, skip link, accurate packages, preselection with unchecked consent, help/focus and privacy/footer behavior. They found no concrete public regression and submitted no form. They are separate desktop observations before this CSS-only card repair, not proof of all private/mobile/native outcomes or the current source identity. Provider receipts establish deployment identity.


Subsequent source-only P3 follow-up: draft PR26 `fbcebb5` corrects scoped athlete/client headings, matching-record singular and overdue-review plurals. All aggregate stages passed in41013346892. Integration66e7e46 passed41013759893. These changes are not in released17 or website70052ad, and no new publication occurred during morning consolidation. See [morning report](../MORNING-REPORT-2026-10-30.md) and [copy receipts](../roster-count-copy/RECEIPT.json).
