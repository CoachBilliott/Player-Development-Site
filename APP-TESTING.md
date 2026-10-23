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
