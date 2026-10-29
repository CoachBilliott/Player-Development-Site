# Repformed Build 14: strict release audit

Audited October 29, 2026. This report audits version **0.1.0 (14)**, source **4641584e801366c1d9e694b7dfb46ce290c4ed99**. The app's product code matches website source c8713b59434172b3c89f8bd637499ae0545fdb07; the intervening commit changes native CI runners/documentation only.

**Verdict: B for the observed interface. Full-product launch readiness has NOT passed.** The navigation and core pilot workflows are materially clearer, but the app does not yet demonstrate the complete advertised weekly learning service. Large-roster behavior needs work. Actual live role isolation and physical iPhone performance remain unverified; they cannot be averaged into a passing grade.

## What was actually audited

- Actual signed IPA: SHA-256 `4ec9d27b401259ccb71bbb20393b9375c3b5158e079a4ef0454491199a54dd7a`, 16,367,797 bytes. This is archive size, not installed footprint.
- Apple processing verified **VALID / IN_BETA_TESTING** at 18:07:20 UTC; available to the existing Owner Testing group. [Signed upload](https://github.com/repformed/Player-Development-Site/actions/runs/40925648089), [Apple receipt](https://github.com/repformed/Player-Development-Site/actions/runs/40927771051). Apple build ID `4eedb1fd-eeeb-4d0e-884b-01d9a7410852`. No public App Store/external beta release or new testers.
- [Six native simulator tests passed](https://github.com/repformed/Player-Development-Site/actions/runs/40921599570): iPhone 17 Pro, iOS 26.2, x86_64, Xcode 26.3. Includes signed-out launch/help/relaunch and synthetic clip trim/transcode checks. Actual native welcome/login screenshots were inspected. These tests do not exercise all signed-in native roles.
- Extracted **exact IPA web assets**, served on loopback, Linux Chromium 154, app-mode, fictional adult fixtures, service workers blocked. CSP and route interception excluded production services. No customer records, emails, passwords or role mutations were created.
- Seven roles: signed out, Owner, Manager, assigned Coach, unassigned Coach, Guardian and adult Athlete. Fifteen audit probes passed; seven additional 320px navigation/layout probes passed. Automated WCAG 2 A/AA and 2.1 A/AA subset found **zero violations in 26 sampled route/role views at each of 390px and 320px**. No horizontal overflow in those samples. This is not full accessibility certification, VoiceOver or Dynamic Type acceptance.
- **64 distinct existing workflow cases passed against the extracted assets.** The first run was 63 passed / one failed: the temporary harness omitted the `phone` project name, selecting a desktop-navigation assertion at phone width. Correcting that harness setting and rerunning the affected case passed; source tests/assertions were unchanged. No second full 64-case rerun was performed. This suite overlaps the role probes and source CI; counts must not be added into a fabricated total.
- Exact source CI was already green: [40921595990](https://github.com/repformed/Player-Development-Site/actions/runs/40921595990). Its unit/database, web, offline, preview and Python checks remain source/fixture evidence, not hosted or physical-device proof.

## Strict scorecard

| Area | Assessment | Reason |
|---|---|---|
| Appearance of inspected screens | **B** | Consistent black/gold identity, legible phone layouts and clear bottom navigation. Login helper row is cramped; repeated help/private-pilot explanations add weight to otherwise simple tasks. |
| Task complexity, small roster | **B** | Athlete detail is one tap from roster. Owner assignment stays inside the selected athlete; cancellation, replacement warning, repeated taps and sibling protection pass fixtures. The overdue action hierarchy is wrong for Owners. |
| Task complexity at scale | **C+** | Search/filter work, but the full roster is rendered and returned together. No pagination in current production path. |
| Sampled automated accessibility | **B+ evidence, incomplete acceptance** | No sampled axe violations/overflow at 320/390px; keyboard/history tests pass. Native VoiceOver, Dynamic Type, enlarged text, physical keyboard and touch accommodations remain unverified. |
| Performance | **Not graded on device** | Local load/search measurements and IPA size are available. No defensible physical-iPhone startup, memory, FPS, thermal/battery or cellular playback numbers. |
| Role security | **Fixture checks pass; live UNVERIFIED** | Direct private routes and UI scope tested with fixtures. Those fixtures implement the expected server; they cannot independently verify deployed RLS/Auth/Storage. |
| Complete weekly package service | **Not passed** | PR13 is unmerged/off. Weekly enrollment/release/library, quiz taking/grading, Friday reminders and capacity alerts are not part of Build 14. Their source implementation is separate and hosted acceptance incomplete. |

No P0 defect was observed within the tested surfaces. That is not a claim that inaccessible paths are free of P0 defects.

## Actionable findings

### N14-01 — P2: login helper and account label run together

**Reproduce:** open the app, tap Log in. The “App help & support →” link ends at the same horizontal coordinate where the lock/account label begins. Confirmed in the real native simulator screenshot and extracted-IPA app-mode rendering.

**Expected:** one clear support action, separated from the status label, without repeated support choices competing with sign-in.

**Evidence:** `native-login-ios26.png`, `signed-out-login.png`; source `src/MemberAccount.tsx` member heading. Local measured link right edge and tag left edge are both ~167.55px at 390px width.

**Fix:** give the help link a deliberate separate row or remove the redundant instance while keeping accessible Help and recovery actions. Retest narrow phone, keyboard, native safe areas and sign-in/recovery. Not fixed in Build 14.

### N14-02 — P2: large rosters have no bounded rendering/pagination

**Reproduce:** Owner roster fixture with 1,000 fictional adult athletes. Current `StaffServiceDashboard.tsx` renders `rows.map(...)` for all results; migration015 roster RPC aggregates the entire allowed scope without a page limit.

**Observed:** **1,005 buttons** in the initial document. Final coarse local sample: ~2.5 seconds to last-row rendering and ~468ms filter response. Earlier independent probes were ~3.0 seconds /139ms. Concurrent regression workload and local browser CPU affect these numbers; they are not controlled native/database benchmarks. Search successfully reduced to the intended athlete.

**Expected:** a bounded page/window, search/filter context preserved, direct athlete context retained. Avoid downloading an entire organization's record set to show the first screen.

**Fix:** first bound rendering without changing access; then validate scoped server paging/search. PR13 contains draft paging work, but do not activate that unaccepted migration merely to repair this issue. Add page-boundary, keyboard, wrong-coach, stale request and selected-athlete tests. Not fixed in Build 14.

### N14-03 — P2: overdue review's primary action points to training assignment

**Reproduce:** Owner → Athletes → an athlete with an overdue pending review. Detail says “Follow up overdue review”, but the first gold button is **Assign training**; **Open review queue** is secondary.

**Expected:** the most prominent action resolves the stated next step. Assignment remains available as a secondary action. Manager/Coach must retain their existing restrictions.

**Evidence:** `owner-athlete-detail.png`; source `src/StaffServiceDashboard.tsx`, `staff-next-step` action order. This is a task-priority defect, not an authorization failure. Not fixed in Build 14.

### N14-04 — P2: help copy still sends administration to personal Account

**Reproduce/source:** video-review guidance says an Owner enables review and assigns a coach “through Account”. The application now deliberately separates Account settings from staff configuration.

**Expected:** refer to the actual staff training-access destination or say “Contact the team” for customers, without widening who can grant access.

**Evidence:** `src/VideoReview.tsx` owner-enablement guidance. This finding is source-verified; the conditional help panel was not independently exercised on a live account. Not fixed in Build 14.

### N14-G1 — P1 launch gate: complete weekly fulfillment is not released/accepted

Build 14 contains the existing pilot workouts, profiles, progress and private reviews. It does not ship PR13's weekly plan enrollment, immutable released library, imported quizzes, server grading/history, Friday reminders or low-content alerts. This is not a new regression and does not mean their source implementation is absent. Production learning remains disabled.

Required closure: isolated hosted role/Storage/quiz acceptance, package completeness gate, Sunday 00:00 America/Chicago DST and Friday dedup checks, preserved prior history, recovery rehearsal and exact production security/scheduler approval. No approval can substitute for failed or missing acceptance.

### N14-G2 — P1 launch gate: real device and live role acceptance incomplete

No physical iPhone installation/update, live representative Manager/Coach/Guardian/Athlete sessions, actual camera/library-to-private-playback, interrupted native network recovery, Keychain/session restoration or physical performance measurement was available. Minimum supported iOS is 15.0, but only native iOS26.2 was exercised. Old OS support cannot be certified from compilation.

Required closure: authorized fictional hosted records and normal role sign-ins, cross-household/sibling/coach denial and revocation checks; owner/partner physical device journey on exact Build14. No real minors or private customer records are needed.

## Role-by-role exercised tasks

| Role | Exercised against exact packaged assets | Still not independently verified live/native |
|---|---|---|
| Signed out | Start→Log in→Help (two taps); password visibility/recovery/history; private entry gates, closed public registration | Real recovery email/deep-link return and Keychain on device |
| Owner | Athletes→detail (one tap), inline athlete assignment/cancel/replace/repeat with sibling unaffected; coach assignment; personal Account vs protected staff directory; training bank; invite/closure controls using mocks | Actual grants, service RPCs and private media through Owner session |
| Manager | Full fictional roster, service coach change, training/staff/account nav; direct Owner administration denied; no workout-assignment or role-grant expansion | Hosted all-client scope and live assignment update/revocation |
| Assigned Coach | Assigned athlete only; detail/back; private assigned review and one feedback completion; Owner routes denied | Real coach RLS/Storage and access after reassignment |
| Unassigned Coach | No other coach's athlete; empty roster and navigation; Owner administration denied | Live unassigned/removed role scope |
| Guardian | Today/Workouts/Progress/Account; selected family athlete; approved adult practice→video→private feedback→refresh; separate profiles/settings; privacy across account switch | Real household/sibling links, guardian withdrawal and native capture/upload |
| Adult Athlete | Solo training navigation, reports/resume/history fixture flows; private profile, failed read and sign-out isolation; staff URLs denied | Live entitlement, own Storage and native offline/resume |

Source fixture tests also exercise the closed junior boundary and synthetic linked-profile restrictions. No actual junior enrollment or child data was used or opened.

## Performance evidence and limits

`summary.json` contains three cold local UI samples per role and coarse medians. They were collected while other regression workers were active. These timings measure browser fixture rendering over loopback, not app launch, remote backend latency or real media throughput. Do not use them in marketing or as physical-device SLOs. Simulator test-suite duration also is not a startup benchmark.

IPA static inspection found expected normal production auth/intake configuration, signup closed and no learning flag enabled. No private signing key/certificate files were embedded in the inspected IPA. This is a narrow archive inspection, not a penetration test.

## Release and recovery safety

No production data, roles, settings, credentials, notifications or website deployments changed during this audit. No email was sent. No new native build was uploaded after14. The existing website/homepage/intake and single shared-inbox interest notification were preserved. PR13 remains unmerged/off; no Cron, paid enrollment, child access or native push activation occurred.

## Recommended next order

1. Correct login spacing, next-action hierarchy and misleading staff-help destination, with focused regression tests.
2. Bound roster rendering and validate scoped paging before calling large-organization usability acceptable.
3. Complete authorized hosted learning and privacy acceptance and DB/Storage recovery gates.
4. Run exact-build physical-device acceptance and measure actual startup/memory/playback/offline behavior.
5. Retest all changed paths and regrade. Do not label blocked areas passed, and do not represent a web/source fix as installed in TestFlight without a subsequent verified signed build.
