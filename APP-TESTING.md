# Phone app testing

Player Development now includes a native iOS project in `ios/`, built with Capacitor 8 around the shared React/TypeScript training client. The mobile client has its own welcome screen, persistent bottom navigation, role-aware workspace links, account access, guided sample sessions and help. The same mobile experience is available as an installable web app at https://coachbilliott.github.io/Player-Development-Site/?source=app#app. The normal public website remains at the root URL. App Store and TestFlight distribution are not active.

## Try the published app

For immediate iPhone testing, open https://coachbilliott.github.io/Player-Development-Site/?source=app#app in Safari, choose Share → Add to Home Screen, turn on Open as Web App if offered, and tap Add. This installs the web-app experience, not a TestFlight binary. The manifest starts the mobile welcome screen. On Android Chrome, the same web-app route supports Install app/Add to Home screen. Browser menu names differ. No developer membership or purchase is required for this route. Use the `#install` screen for updates and detailed installation instructions.

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

## Build and test the native iOS app

The provisional bundle identifier is `com.coachbilliott.playerdevelopment`, display name Player Development and version 0.1.0. The iOS project bundles the app shell and illustrative sample sessions, uses local app assets (no remotely loaded application URL), follows safe-area insets and uses the original PD launch icon. Native Auth sessions use the iOS Keychain through a scoped storage adapter; there is no fallback to unencrypted browser storage for native sessions. Private profile/media API responses remain uncached. Native app foreground/background events start/stop Auth refresh and recheck account access on resume.

```sh
npm ci
npm run build:ios
npm run open:ios
```

Native compilation needs a Mac with Xcode and an iOS Simulator runtime. This workspace is Linux; the repository's **iPhone app build and simulator tests** workflow runs Xcode on a standard GitHub-hosted Mac. The repository is public, so the standard runner route does not require purchasing a service. It generates test targets with XcodeGen, runs a real Keychain round-trip against the app's WKWebView bridge, exercises welcome/demo/relaunch persistence and the sign-in form in an iPhone simulator without entering real credentials, and prepares an unsigned iPhone device archive. Build logs, test results and screenshots are saved as workflow artifacts. Simulator `.app` files run on compatible Macs; unsigned device archives cannot be installed on an iPhone or submitted as a TestFlight build.

To regenerate the additional test targets locally on a Mac:

```sh
brew install xcodegen
cd ios/App
xcodegen generate
```

Password resets, verification and adult account setup open the existing HTTPS website in the system browser. Finish those email steps there, then log in to the app. The app does not change the Supabase redirect allowlist, add custom email callback schemes or weaken the existing child/role gates. iOS file-picker purpose strings cover camera/microphone/photo access only if a staff user explicitly chooses that upload option; no permission is requested automatically.

## Physical iPhone distribution remains an owner step

The owner does not currently have an Apple Developer Program membership. TestFlight distribution requires that membership, an App Store Connect app, an approved bundle ID/team, signing/provisioning, privacy/age-rating/export-compliance answers and the applicable beta review. Nothing has been purchased and no Apple credentials or security settings have been changed. After enrollment, sign the prepared native project in Xcode and upload a signed archive to App Store Connect; add the owner/partner as testers through the supported Apple workflow. A Mac/Apple ID can also support limited personal development-device testing under Apple's rules. Neither route guarantees store approval.

Before public release: perform physical-device account/email handoff, role isolation, file picking, session persistence, keyboard/safe-area, background/resume and accessibility tests; review native privacy disclosures and training content; finish verified guardian consent before enabling juniors; define membership entitlements and compliant billing before activating purchases. No checkout, push messaging, biometric gate or real junior account activation is added by this build.

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

## Real training footage checks

The hero uses licensed, locally served adult training footage with native silent looping and no visible replay/pause/motion controls. Tests verify actual playback, a wrap from the end to the beginning, mute/inline/no-controls attributes, no audio track, no practice records from viewing, automatic still fallback for device reduced motion, and usable fallback when video requests fail. Promotional video files are not in the offline app-shell cache; the still and credits are. Football is still the only available program, future sports have no active enrollment controls, and the single customer demo remains usable. Automated checks do not replace a physical iPhone/Android autoplay and low-power-mode check.
