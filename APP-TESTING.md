# Phone app testing

Player Development uses one React/TypeScript project for the website and an installable web app. It has not been submitted to the Apple App Store or Google Play.

## Try the published app

Open the current website's `#install` screen. On iPhone/iPad, open in Safari, choose Share → Add to Home Screen, turn on Open as Web App if offered, and tap Add. On Android Chrome, use Install app when offered or the browser menu's Install app/Add to Home screen option. Browser menu names differ. The app can still be used as a website if installation is unavailable. No store account or purchase is required for this route.

Open online first and wait for “Demo screens are ready for offline use.” Built-in fictional sessions and local progress can then reopen offline. Shared-library loading, sign-in, new uploads, updates and remote media require a connection. Browser and home-screen app storage may differ on some devices; installation is not account creation or cross-device sync.

App updates wait rather than interrupting an active screen. Go to Get the app → Check for updates; when one is ready, choose Update app and confirm the reload after saving work. Cancel keeps the current version. Saved demo progress remains in the same browser/origin. Never uninstall, clear site data or change origins to update a test; doing so can remove local records and files.

The service worker caches only the scoped app shell, local fonts and icons. It does not cache the content configuration, authentication, service API responses, signed media or uploaded files. It uses a scope-specific cache prefix, retains one previous shell for existing tabs and never unregisters unrelated service workers or deletes unrelated caches.

## Automated checks

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:app
```

`test:e2e` covers training, content editing, combined filters, local files, failure/cancellation, persistence, accessibility and shared publishing with fictional intercepted service responses. `test:app` builds the production files, runs a preview server and exercises actual service-worker installation, offline navigation and session completion, canceled installation prompts, and an actual waiting worker update that requires confirmation and preserves saved storage. The operating system installation prompt is simulated for the cancellation test; native OS installation is a manual device check. The app test report is in `playwright-report-app/`.

## First owner/partner test round

Use fictional profiles and original sample media. On physical iPhone Safari and Android Chrome: install from the website, launch the icon, choose a sample player, complete a session, close/reopen and verify history, use airplane mode after offline preparation, reconnect, upload/edit/replace/remove a local file and test Cancel. Check text zoom and reduced motion. After the shared service is activated, repeat coach publication on one device and confirm visibility on the partner's separate browser.

Report each issue with screen/link, device/browser, steps, expected result, actual result and whether it blocks use. Do not include real children’s information. Fix blockers before appearance refinements.

## Native stores later

If store distribution is required, choose a native wrapper or dedicated native client after validating the web workflows. Then prepare Apple/Google developer accounts, signing, bundle identifiers, privacy disclosures and the applicable TestFlight/Google Play testing tracks. Developer account fees and store review rules may apply; the current web app neither needs nor creates those accounts. Never promise store approval or purchase accounts without owner authorization.

## Private account checks

`tests/accounts.spec.ts` uses fictional intercepted Supabase Auth/REST responses with the actual SDK. It covers signup/PKCE verification, recovery/password updates, parent/adult setup, create/edit/delete/cancel, lost responses, rapid taps, refresh, cross-device reads, account switching, profile-data deletion, accessibility and 320px layouts. `src/accountPolicies.test.ts` executes the member migration in embedded PostgreSQL and verifies household RLS, consent/type restrictions, parent-only under-18 management, the closed enrollment gate, ownership immutability, version conflicts and deletion scope.

Neither proves a live Supabase project, SMTP delivery or physical-device email/browser handoff. Complete the acceptance list in `backend/SETUP.md` before enabling member registration. Private profile data must never appear in the service-worker cache or `pd-demo-v1`; only the Auth session may persist in browser storage.

## Account-level checks

`src/rolePolicies.test.ts` applies all three migrations and verifies the five-level permission matrix, Owner-only grants/directory, self/last-Owner protection, stale writes, immutable audit records, staff profile isolation, coach content/file ownership, Athlete personal-profile limits and safe role preservation during repeated setup/deletion. Browser tests cover every level, Owner role changes, cancelled/failed/repeated submissions, refresh persistence, search and mobile accessibility. All browser backend responses remain fictional; live RLS checks use isolated transaction fixtures that roll back.

## Family athletes and review

`src/familyPolicies.test.ts` executes migration 004 and tests one-athlete family links, sibling isolation, parent-only permission/review, idempotent reports, revocation, hashed/expired/single-use codes, standalone adult reports, server-derived session metadata, guardian gates/markers, age-band bypass prevention and private wrapper permissions. `tests/family.spec.ts` exercises the public fictional demo, cancellations, browser storage failure, individual mode, per-athlete histories, approvals and phone accessibility. `tests/accounts.spec.ts` also runs the real SDK against intercepted family RPCs through parent/athlete account switching, private code acceptance without an adult declaration, reports, approval persistence and revocation. These are simulated identities, not real children.

Verify the actual public `#family-demo` URL separately from the signed-in pilot. Live child access must stay closed until qualified consent/age-transition review and real-device guardian workflows are complete. All live QA identities are fictional adults and are rolled back; recording/review is participation reporting, not athletic measurement.

## Public/demo/private view checks

`tests/views.spec.ts` verifies the public website and a single customer demo entry with Parent & family and Solo athlete journeys, no staff-role gallery, legacy preview redirects, isolated practice history, approvals, cancellations and phone accessibility. Staff preview URLs require real workspace sign-in. Anonymous visitors cannot open even the local upload editor. `tests/accounts.spec.ts` verifies authenticated Owner/Manager/Coach/Parent/Athlete/Junior workspaces with fictional intercepted SDK identities. Local editor tests sign in through the shared SDK fixture rather than enabling a production bypass.

`src/contentAccess.test.ts` runs all five migrations to verify protected-default content, public-sample opt-in, unpaid-member denial, metadata/media isolation and staff ownership. The corresponding live SQL checks use fictional adults and roll back every fixture. This customer-demo simplification changes no backend grants, billing settings or child-enrollment gates. See VIEWS-GUIDE.md.

## Athlete-first brand checks

The homepage uses a sport-neutral original athlete illustration. Motion checks cover Move/Focus/Build theme changes, actual marker movement, replay, global pause persistence and reduced-motion static behavior without creating training records. Homepage checks verify that football is the only available program, future sports have no training/enrollment controls, the football demo links to the same `#demo` customer journey, and small-phone layouts/accessibility remain usable. The app manifest and page description use the broader Player Development brand; no additional sports, payments or account permissions are activated.
