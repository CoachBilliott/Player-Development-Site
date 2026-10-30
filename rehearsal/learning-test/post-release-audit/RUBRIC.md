# Strict post-release audit protocol

Prepared October 30, 2026. This is the next-audit protocol, not a completed audit or a promise of an A grade. Use actual publication receipts before selecting the audit target. Do not substitute a fictional preview or a draft branch for production.

## Immutable targets and evidence classes

Record the canonical website URL, production deployment ID, exact source SHA, static configuration hash and observation time. For the app, record version/build, source SHA, IPA hash, Apple processing/distribution status, device model, OS, installation source and network. Verify the installed build through its own information screen. An Apple upload receipt does not prove an iPhone installation or a functional role journey.

Every result identifies one evidence class:

- LIVE-WEB: actual public production or an authorized normal production-role session.
- HOSTED-TEST: ordinary Auth/JWT and Storage against the approved isolated project and fictional actors. This does not prove production configuration.
- NATIVE-DEVICE: installed distributed build on an identified physical device.
- NATIVE-SIMULATOR: exact-source simulator test, with real versus mocked backend identified.
- LOCAL-FIXTURE: automated fixture/PGlite/browser observation; valuable regression evidence, not a hosted permission pass.
- SOURCE-ONLY: reviewed code or provider metadata. Not behavioral acceptance.

No result crosses these classes silently. Record PASSED, FAILED, BLOCKED, NOT RUN or NOT RELEASED. Preserve failures and later retests as separate records, linked by case ID. Never replace a failed receipt with a later optimistic summary. Redact passwords, tokens, email addresses and private records. Use approved fictional actor aliases only.

## Domains, scoring and coverage

Report six domain scores separately for each exercised role and platform: usability/task complexity, appearance/accessibility, performance, permissions/privacy, training delivery/history, and errors/recovery. Do not average website, simulator and physical-device results, or one role into another. Unreleased features get NOT RELEASED; inaccessible roles get UNVERIFIED, not a passing score.

A numerical domain grade requires all critical applicable cases and at least 90% of its planned applicable cases to be exercised in that evidence class. Show the numerator/denominator and list missing cases alongside any score. Otherwise report PARTIAL or UNVERIFIED with observations. Do not remove blocked cases from the denominator to improve the grade. Only a documented genuinely inapplicable feature may be excluded.

For observed design/usability domains, start at 100 and deduct 20 for a severe task obstruction, 7 for a material usability defect, and 2 for minor friction. Distinct root causes count once per affected domain, with their affected journeys listed. A clean small sample does not establish full coverage. Grade bands: A+ 97–100, A 93–96, A− 90–92, B+ 87–89, B 83–86, B− 80–82, C 70–79, D 60–69, F below 60. These are assessment rules, not product promises.

Permission and critical delivery/recovery acceptance are primarily PASS/FAIL/BLOCKED; decorative polish cannot offset them. A P0 or open P1 in unauthorized private access, account takeover, irreversible data/history loss, incorrect trusted grades, wrong-athlete assignment, duplicate destructive/billable actions, or critical content delivery vetoes LAUNCH READY regardless of other grades. Missing security or restore evidence also prevents a full launch-ready conclusion. An interest-only prelaunch release may be evaluated separately from paid training activation.

Severity:

- P0: confirmed severe unauthorized access, broad data loss or immediate critical safety/security exposure. Stop the affected release and preserve evidence.
- P1: essential journey blocked or materially incorrect, isolation/scoring/history failure, or no workable recovery. Release blocker for that affected product slice.
- P2: significant confusion, accessibility obstacle or scaling defect with a safe workaround; fix and retest before declaring the target quality achieved.
- P3: cosmetic or small friction without task failure. Record rather than inflate severity.

Do not assign a numerical security grade from source review alone. A denied request without a valid authorized positive control cannot prove correct isolation.

## Representative role journeys

Use existing authorized sessions. No real-customer mutation, impersonation, new account, changed role, new permission or email is implicitly authorized by an audit. Pause any case that lacks its specific test authorization.

- Spectator: packages, customer help, interest selection without submission, privacy return, login/recovery navigation, fictional-demo limits, no private metadata.
- Owner: roster search/filter/page, exact-athlete context and sibling distinction, coach reassignment cancel/confirm only where separately authorized, library and content approval, personal versus staff settings, failed/stale action recovery.
- Manager: all-client service scope and coach assignment where authorized, permitted content review, explicit denial of Owner-only roles/configuration/enrollment; no hidden navigation interpreted as security.
- Assigned Coach: assigned roster/detail and authorized review workflows, no other-household/direct-ID access, no Owner-only changes, loss-of-scope behavior tested only with separately approved mutation fixtures.
- Unassigned Coach: empty assigned scope and denial of unrelated direct IDs. Current six-user fixture has no truly unassigned Coach, so this remains separately blocked until an approved fixture exists.
- Guardian: correct household and selected sibling, training/progress/feedback context, no other household, consent/privacy controls, no answer keys or trusted-grade mutation.
- Athlete/adult: own authorized content, resume and completion, no staff catalog, unpublished weeks, sibling data, scoring key or grade mutation. The current six-user fixture has no separate athlete Auth identity; do not claim that normal-role coverage.

## Measurement procedure

For each core task, record route, actor alias, starting state, goal, taps/clicks, required page transitions, backtracks, confusing decisions, completion outcome and elapsed time. Compare before/after only with the same task, fixtures and device class. Do not equate fewer clicks with a safer or better workflow if context/confirmation is lost.

Performance: record at least five cold and five warm starts for a claimed device measurement, with network/cache state, median and worst result. Record app launch to usable screen, roster search response, first-frame playback, upload progress/retry and background resume where authorized. Measure web navigation/LCP/INP/CLS with the actual tool and throttling stated; avoid invented device metrics from bundle size. Use standard web-vitals good thresholds as diagnostics, not as proof of physical-app performance. Capture memory, crashes or thermal behavior only with tools that actually observe them. Unsupported measurements stay NOT MEASURED.

Appearance/accessibility: 320/375/390 px and desktop, safe areas, keyboard, 200% text/zoom, long names, empty/large/error states, contrast measurement, skip/focus order, dialog focus return, reduced motion, playback pause, touch targets and scroll/overflow. Automated axe results complement manual keyboard/visual tests; they are not full WCAG certification.

## Training and recovery gates

Until weekly learning is accepted and activated, label its cases NOT RELEASED rather than fail live production for a feature intentionally off. Test draft behavior separately in the approved environment: official package item counts, server-side readiness, Sunday 00:00 America/Chicago DST, Friday unfinished-only reminder/dedup, staff capacity warnings, pauses/resume/repeat/overrides, partial failures and no retrospective flood. Verify immutable released library, quiz keys unavailable before submission, deterministic server scores, written review scope, sibling attempt/grade separation and template re-import history.

Before production activation, require actual Auth/Storage acceptance, separately approved 022/024 and production permission/media changes, documented DB plus private-object restore evidence and rollback preserving progress. Do not invent retention, credit-period, refund or storage-budget policy. Flags off is a containment mechanism, not proof that private originals or data can be restored.

For the live interest flow, inspect loading/error/consent and private staff boundaries without generating extra submissions or emails. Existing canary receipt is historical end-to-end evidence; rerunning a canary needs its explicit bound and recipient. Routine client email, overdue scheduler, marketing, payments and junior enrollment remain off unless separately approved.

## Release and re-audit receipt

1. Freeze exact tested source and required terminal CI. Explain any failed run and its repair; no skipped mandatory stage counted as pass.
2. Publish through the existing authorized workflow, fresh normal Auth configuration, and verify provider deployment and actual available pages. Never promote a disconnected test artifact.
3. For native, wait for exact build processing/distribution, then audit exact installed build where available. Keep simulator/device evidence separate.
4. Execute the case ledger, record expected versus observed, reproduction, evidence location and severity. Do not force grade targets.
5. Fix authorized reversible defects, rerun affected checks and audit the actual replacement release. Preserve the prior findings.
6. Final report leads with actual shipped scope, open P0/P1 gates, domain/role coverage and exact limitations. No blanket “all roles pass” or “launch ready” with unverified domains.
