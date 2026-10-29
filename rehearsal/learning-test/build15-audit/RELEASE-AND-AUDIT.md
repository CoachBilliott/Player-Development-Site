# Repformed 0.1.0 (15): release and bounded follow-up audit

October 29, 2026. Exact released source **0816c343a99a76e03ad2e48c7e16207058624c02**, [PR20](https://github.com/repformed/Player-Development-Site/pull/20). This is the four-defect follow-up to the finalized [Build14 audit](https://github.com/repformed/Player-Development-Site/blob/eb026a9e5b514fa193674f181207f517309547ae/rehearsal/learning-test/build14-audit/AUDIT.md). It does not retroactively change Build14's results.

## Release verified

- Website: https://repformed.com ; production deployment **bab6aa19-838c-424e-8aa1-d562cb7a88c2**, [immutable deployment](https://bab6aa19.repformed.pages.dev), created 19:46:55UTC and successful 19:46:57UTC. Provider metadata confirms the exact source above. Entry `assets/index-CiTCzc3S.js`. Independent public-browser acceptance remains separate; the coding worker did not repeat its known blocked403/1010 frontend requests.
- TestFlight: **0.1.0 (15), VALID / IN_BETA_TESTING**, verified 19:53:24.989UTC by [Apple status40944073621](https://github.com/repformed/Player-Development-Site/actions/runs/40944073621). Existing **Owner Testing** group lists15. [Signed upload40942332407](https://github.com/repformed/Player-Development-Site/actions/runs/40942332407) succeeded 19:48:29UTC; delivery/build ID `8a6cbee2-4168-4ec5-bafb-400ffc6c2ca0`.
- No new credentials, permissions, testers, external beta or App Store submission. Public signup and weekly learning remain off. Homepage, package definitions, interest collection/consent and the existing business-inbox notification configuration were preserved; no form was submitted or email triggered in this audit.
- Normal production auth/configuration SHA256 remains `bce7ca9fc4b5806db2b10d51e0ef06a04c455bf36d145d331409bb94b0f1c39c`. This was a fresh normal-auth build, not the disconnected preview artifact.

The first Cloudflare upload-token request failed400/code9106 before an upload. The old production deployment was inspected and remained unchanged. Later the existing runtime's readiness recovered from UNKNOWN to READY/ENFORCED. After checking for intervening deployments and revalidating the artifact, **one same-route/same-credential retry** succeeded. No token creation, scope expansion or credential switch occurred. Read-only browser metadata independently confirmed the existing token had Pages Read/Write. The initial authorization failure's exact root cause is not established; new credentials were not necessary.

## Four findings: outcome

| Build14 finding | Follow-up result | Evidence / limit |
|---|---|---|
| Login support link touches account label | **Fixed**: removed redundant inline support row; header and bottom-nav Help remain | Actual exact-source native simulator login screenshot inspected; desktop/phone keyboard Help regression; signed-IPA screen reproduction |
| Roster renders every athlete | **UI rendering fixed; server scale remains open**:25 rows/page, page retained on detail/back, search/filter reset, last-page/shrinking-refresh handling, keyboard focus |1,000 fictional adults now32 buttons vs1,005. The unchanged old RPC still returns the entire authorized scope. Server pagination/search/filter is the next separately gated batch; no claim of hosted scale certification |
| Overdue review emphasizes assignment | **Fixed**: review queue leads; Owner training assignment remains secondary | Main CI action-order regression and exact signed-IPA Owner detail screenshot. No Manager/Coach assignment expansion |
| Review help points to personal Account | **Fixed**: current Training/individual lesson-review permissions guidance; direct link for Owners only | Owner navigation test reaches correct heading; Manager/Coach link absent and existing denied-route tests retained |

## Validation actually completed

- [Final PR CI 40934610403](https://github.com/repformed/Player-Development-Site/actions/runs/40934610403) and [exact main CI 40936961175](https://github.com/repformed/Player-Development-Site/actions/runs/40936961175) passed. Each included378 unit/database tests,424 web browser tests,10 app/offline cases,6 isolated-preview cases,11 Python tests, lint/types/Deno/build. These are overlapping repeated suites, not848distinct web cases.
- New regressions:16 desktop/phone cases, including1,000 records, page/detail/back/focus, search/reset/no-results, final partial page and smaller refreshed scope, Owner review priority and Owner-only permission link. Initial local setup collisions/selectors were corrected; the final single16-case run passed. No protection assertion was weakened.
- [Native40937081398](https://github.com/repformed/Player-Development-Site/actions/runs/40937081398) passed:6 tests,0 failures/skips; iPhone 17 Pro simulator, iOS 26.2, x86_64, plus unsigned device archive. Actual native welcome/login captures from this source were inspected. This does not certify live signed-in native roles.
- Downloaded the **actual signed IPA15**:16,368,160bytes, SHA256 `8344c4d3a0514b0c246cb448315ff95a908243a15f84006917803cd3b0ac1c62`. Bundle/version/display name/production flags verified; no private signing files found. Archive size is not installed-device footprint.
- Compared72website release files with the IPA's web payload: all JS/CSS/assets/configuration match; only`sw.js` differs. Its29 asset set and logic match after normalizing asset order and generated cache identifier. Native service-worker registration is disabled. Native-only extras are`cordova.js` and`cordova_plugins.js`. No missing release files. See`build15-ipa-static-audit.json`.
- Exact signed-IPA assets served on loopback, Chromium154, app-mode, fictional adult backend fixtures, production networking blocked: **15 role/layout probes passed**. **7 additional320px probes passed**. Seven role presentations: signed out, Owner, Manager, assigned/unassigned Coach, Guardian, adult Athlete. At 390/320px,26 sampled route/role views per width had zero automated WCAG-subset findings or horizontal overflow. This is not native VoiceOver/DynamicType or live RLS acceptance.

## Performance and complexity

The final1,000-record extracted-IPA probe rendered25 rows/32 buttons; coarse local first-page-ready466 ms, search40 ms. Build14's unpaged probe rendered1,005 buttons and measured approximately2.5–3 seconds to the last rendered row and139–468 ms filtering. Workload and measurement targets differ, so these are not controlled speedup benchmarks. The bounded DOM and successful full-scope search are the demonstrated improvement. Actual database latency, network payload scale and physical-iPhone startup/RAM/FPS/battery remain unmeasured.

Athlete detail remains one tap from the roster. Back preserves page and focus. Search does not require paging through every athlete. Overdue work now has a matching primary action. Owner/Manager service-coach scope and assigned-Coach visibility remain unchanged. Role fixtures do not independently prove deployed server restrictions.

## Strict reassessment

**Observed interface and bounded daily workflows: B+.** The four tested UI corrections improve usability; broad production scalability remains ungraded because the API still returns all authorized records. There is **no full-product launch pass** and no artificial average over blocked security/device gates.

Still BLOCKED/UNVERIFIED:

- Physical-device install/update, actual camera/library/private playback, real Keychain/recovery/offline behavior, native launch/memory/FPS/battery, older supported iOS, VoiceOver/DynamicType.
- Representative live Manager/Coach/Guardian/Athlete sign-ins and real hosted household/sibling/coach RLS/Storage/revocation. No real account or role was mutated to fabricate coverage.
- PR13 weekly enrollment/release/library, imported quizzes/server grading/history, Friday reminders and capacity alerts: unmerged/off, hosted acceptance incomplete. No production learning migration/Cron/youth access or paid credits were activated.
- Reviewed package-aligned instructional media and final storage/retention/billing policies. No invented coaching approval or athlete outcomes.

Next authorized batch is server-scoped pagination/search/filter/counts with unchanged roles, plus an honestly labeled sample learning journey. Any production security-sensitive RPC/migration activation requires the exact separate approval and rehearsal. Existing production data and history remain untouched.
