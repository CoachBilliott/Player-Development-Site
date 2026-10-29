# Public spectator audit follow-ups

Independent browser observations supplied by the coordinating task: actual live spectator navigation at repformed.com, October 29 04:00–04:02UTC, passed homepage, packages, Contact, login, demo, installation, account help, privacy and credits on desktop, with appropriate prelaunch disclosures. No form was submitted. Mobile, privileged-role, destination-social and form-delivery audits were not performed. This worker did not repeat the Cloudflare-blocked frontend request or bypass the pending browser upload approval.

These observations precede the proposed copy-only release. Provider provenance at that time remains staff release a58bd82 / cccba94e. A future copy release has its own separate receipt; do not count old browser QA as first-hand post-release QA of a new artifact.

## Low, fixed: homepage tense conflicts with inactive package status

Live #home said “Drill-package plans use Sunday loading,” while Membership accurately describes proposed packages and inactive enrollment. Published correction: “Proposed drill packages would release content on Sundays to give the week a clear starting point.” Only Home.tsx and its existing browser expectation change. No schedule, package price/cadence, design, intake or learning activation changes. [PR #14](https://github.com/repformed/Player-Development-Site/pull/14) carries the fix. Lint/types/build and 16 focused desktop/phone checks passed; PR and post-merge CI passed; exact source/deployment and results are in COPY-RELEASE.json.

## Low: email fallback flashes while enabled intake configuration loads

**Confirmed local presentation defect matching the reported live symptom.** `useSharedContent` initializes `interestEndpoint` to null, then asynchronously fetches no-store content-config.json. App passes only the endpoint to Membership, which interprets null as the disabled/unavailable state immediately; the public email fallback appears before configuration arrives. With an enabled configuration, the direct form replaces it after the endpoint is parsed.

A controlled local run against the actual compiled app held only the configuration response: Email package interest was visible and Send interest absent before config; after enabling config, Send interest appeared and the email fallback collapsed. No form interaction/submission or provider delivery was tested. This is not evidence that interest persistence or email delivery failed. It is more noticeable on slow networks and can briefly send a visitor to the secondary email path.

Recommended separate UI correction: distinguish configuration pending from disabled/failed, show a bounded loading state, and preserve the explicit secondary email fallback only once readiness is known. Keep the existing true-disabled/offline failure path and never show a false submission success. **Investigation only; no intake source change is included in the copy PR.** The service worker excludes content-config, API, authentication and private/uploaded-media requests, so this flash is initial UI state, not stale cached private data.

## Expected update banner; separate low multi-tab state/action mismatch

“An app update is ready” is expected after a deployment when an older controlled tab has a newly installed waiting service worker. `usePwa` reads `registration.waiting` and an installing worker's installed state. The user must confirm before a reload so unsaved work is not discarded. This is the web/PWA shell, not a native TestFlight update.

**A distinct multi-tab waiting-state/action mismatch was reproduced locally with real service workers.** Two same-origin tabs showed a genuinely waiting update; tab A accepted/reloaded it. Tab B's controller then reached activated, and its registration had no waiting worker, but the banner remained visible after an additional settle period. The controllerchange/activated paths set offline readiness without clearing waiting UI state. The normal update action then has no waiting worker to activate and falls back to “no longer waiting / close and reopen.” This is confusing, but another live tab may still legitimately need to reload its older running JavaScript after a different tab activates the new worker. No claim is made that every banner with no waiting worker represents an already-current runtime. Private profile retention and cache-exposure behavior were not tested by this reproduction.

Recommended separate correction: distinguish a waiting worker from a newly active controller whose older tab still needs a reload. Keep an appropriate save-and-reload confirmation for that older tab, rather than silently reloading it or merely clearing its only update path. Refresh waiting state truthfully. Regression should cover first install, two tabs, cancellation, no automatic reload and retained local state. **No PWA source change is included in this copy PR.** The actual live browser's registration state was not inspected, so its reported banner alone cannot determine whether it was genuine or stale. A new copy deployment can legitimately offer another update.

## Evidence and boundary

[LOCAL-INVESTIGATION.json](LOCAL-INVESTIGATION.json) records the controlled real-SW/UI states, not live browser or provider acceptance. The temporary server/browser contexts used local artifacts and blocked foreign calls; zero interest submissions and zero outgoing email. Existing page/data/actor contexts were not reused or cleared. Local screenshots remain task deliverables; no private customer screenshots or credentials are published.

The paused browser upload and all weekly-learning production/security/recovery gates remain unchanged. Do not count this spectator follow-up as the rigorous Owner/Manager/Coach/family audit or as physical iPhone acceptance.
