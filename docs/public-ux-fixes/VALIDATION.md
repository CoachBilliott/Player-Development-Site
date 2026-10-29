# Interest loading and cross-tab update correction

## Behavior

- Membership waits for the public configuration decision before displaying either the direct interest form or the manual email fallback. Pending state is announced as “Loading interest form…”, without a misleading email-app action. Disabled, invalid, failed or timed-out configuration still offers the existing honest manual fallback.
- The configuration request has a 15-second deadline. It does not time out an active Auth session or clear stored account state. The form decision is independent of subsequent account restoration.
- When another tab activates an update, the current tab keeps running without reloading. Its action becomes “Reload this tab”, behind the existing save-work confirmation. Cancel preserves the current document. Confirm works even after there is no longer a waiting worker. First installation does not present an update prompt.
- Confirmed update application is guarded against repeated actions; failed worker application can be checked again.

No backend, permissions, runtime configuration, notification dispatch, cache privacy policy or native release changes. No real browser tabs are automatically updated by testing.

## Local validation

All checks below ran on the correction source; CI separately runs the complete release suite.

- Lint, TypeScript and normal production build passed.
- 375 unit/database-policy tests and 11 Python tests passed.
- 26 focused website cases passed across desktop and phone: pending/ready configuration, disabled/error/malformed/deadline fallback, keyboard/focus/accessibility, existing submission validation, consent and idempotency/failure handling. Intake requests and email results in these tests are synthetic mocks, not live submissions.
- 10 compiled-app/offline cases passed across desktop and phone. They use real local service workers, including two tabs, first installation, confirmed/canceled updates, unsaved in-memory state, persistent fixture data and synthetic authenticated-session restoration. No real customer session was used.

Screenshots generated under ignored `artifacts/public-ux-fixes/`: interest loading/ready and the second-tab reload state, desktop and phone. These show local production-source behavior, not independent live-browser acceptance.

## Release and acceptance boundaries

Release only after the final exact-head aggregate CI passes. Build a fresh normal-auth artifact; preserve the production configuration byte-for-byte and retain the previous hashed artifact for rollback. Verify provider production deployment source and main CI. The coding worker's public frontend requests are restricted (Cloudflare 1010); do not bypass that restriction or claim independent live-browser QA. No live form submission/email is necessary for these UI corrections. Weekly learning PR #13 and its migrations/scheduler remain separate and off. Native TestFlight build 13 remains unchanged.
