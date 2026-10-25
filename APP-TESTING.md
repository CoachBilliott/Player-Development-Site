# Player Development app testing

The native iPhone app **0.1.0 (7)** is available in the existing **Owner Testing** TestFlight group. Open TestFlight → Player Development Test → Update. The public website is [live here](https://coachbilliott.github.io/Player-Development-Site/); its one customer demo stays on the website. The browser app preview is `?source=app#app` and is separate from installing the native TestFlight binary.

## What works

- Verified private account login and iOS Keychain session storage; Owner/Manager/Coach and Parent/Athlete permissions remain separate.
- Real account plans use only assigned, published protected workouts matching the athlete's age, position and experience. No demo profiles or drills are imported.
- Today, Workouts, Progress and Account for customers. Staff use their authorized content and video review tools.
- A focused drill screen with the attached demonstration, visible instructions, equipment and cue, then Complete drill / Finish workout. Only submitting practiced work creates a participation report.
- Optional private video review: Record/Choose → Preview → Send; server access checks; family approval before linked-athlete clips reach the coach; private feedback and confirmed clip deletion. See [VIDEO-REVIEW-GUIDE.md](VIDEO-REVIEW-GUIDE.md).
- Owner account controls assign workouts and review access separately. Withdrawal/deletion prunes obsolete workout assignments without deleting existing video feedback.

Manual pilot permissions do not represent a subscription or payment. Real junior enrollment and video uploads remain closed. Activities await qualified coaching review; reports, parent approvals and feedback do not prove athletic improvement.

## Upload and guided-practice update retained from build 6

Build 6 adds explicit device drafts for new shared uploads, editable purpose/equipment/coaching cues, and a clearer session order/next-drill/previous-drill experience. See [UPLOAD-GUIDE.md](UPLOAD-GUIDE.md) for the device-only draft limits and fresh rights confirmation. Draft files are isolated by staff account, excluded from demo storage, and cleared on sign-out/account change. Failed device storage preserves the open form. Existing resource edits retain their instructional content and drill kind. No schema, role, payment, junior gate or live account data change is needed for this update.

The current website HTML/JavaScript/CSS match the tested release and signed binary. Apple reports build 7 as VALID and IN_BETA_TESTING, and Owner Testing includes it.

## Automated and live verification

The released source `41bdd8653aa3c07be922fe71e1d72d240a93c59d` passed lint, type checking, production build, **148 unit/database-policy tests, 162 desktop/phone browser tests, 8 installed-web-app tests, 10 signing tests and 3 native simulator tests**. Clean GitHub runs: [web checks](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40150996266) and [native build/tests](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40150995850).

Another **16 workout-builder checks on the actual deployed website** use intercepted fictional backend responses: composition, ordering, protected previews, snapshots, eligibility, assignment, saved-name history, canceled actions, response failure/retry, permissions, phone overflow and accessibility. Previously released device-draft and guided-practice regression cases remain in the full browser suite. No real customer records or media were written by those tests. The filled staff editor also has zero detected WCAG A/AA violations. Device drafts stay in a separate account-keyed IndexedDB store; they never enter demo localStorage or the service-worker cache.

Native tests ran on iPhone 17 Pro / iOS 26.2 with Xcode 26.3: assets/font/native bridge and Keychain round-trip, no app demo/legacy demo route access, private login/navigation and relaunch. They do not establish physical camera, real Storage upload/deletion, background transfer or iPhone device-draft persistence acceptance.

Previously completed live database acceptance uses fictional adult fixtures inside rolled-back transactions: matched assignments, private assigned-coach access, report/feedback isolation, finalization idempotency, cleanup guards and withdrawn-resource handling. Migration 008 adds private workout templates and snapshot assignments; it creates no real assignments and changes no account roles, enrollment/consent gates or payment settings. Live workout checks used fictional adult fixtures in rolled-back transactions and confirmed order, privacy, snapshot versions, idempotency, stale-report rejection and whole-workout withdrawal handling. Anonymous REST/RPC probes were denied. Production media and physical-device checks below remain necessary.

The signed IPA passed ZIP integrity, bundle/version/build, expected team/profile, signature-resource presence, no-private-keys and exact bundled-HTML/JavaScript/CSS comparison with the verified website. [Signed upload](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40151731165) succeeded. [Apple state verification](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40152098500) confirms VALID / IN_BETA_TESTING and group inclusion for build 7.

## First physical-iPhone acceptance

Use fictional profiles or approved adult pilot accounts only.

1. Install the latest verified build shown above, launch from the icon, confirm there is no app demo entry, sign in/out, relaunch and check account isolation. Staff should see their staff account directly, with no Parent/Athlete choice. Parent/Athlete setup applies to customer training accounts.
2. Upload an original adult/noncontact drill, publish protected, and assign it to the test account. Start a workout, play its demonstration, read instructions, complete practice and check history after relaunch. Cancel an unfinished workout and confirm no practice report appears.
3. Enable review access and select a coach. Test camera/microphone/photo prompts, recording a short adult/fictional clip, saved MOV/MP4 selection, canceling the camera/picker, preview playback and explicit Send. Test a clip over 60 seconds/40 MB, unsupported/corrupt media and selecting the same file again.
4. Test a failed connection/retry, repeated Send taps, background/resume and app termination during upload. An unfinished upload must remain labeled unfinished; it is not a successful review submission. Clean it up from video history if necessary.
5. Check only the authorized family and assigned coach can open the clip; linked-family athlete clips need parent approval. Save feedback and verify it after relaunch. Cancel deletion, then delete permanently and confirm history/storage cleanup. Delete clips before removing their profile data.
6. Check 320px-equivalent layouts, large text, VoiceOver, keyboard, safe areas, rotation and native video fullscreen controls. Run the same flow on the partner's iPhone after their TestFlight access is ready.

Report device/iOS version, build number, screen, steps, expected/actual behavior. Do not include credentials or actual children's media in recordings/issues.

## Run locally

Use Node from `.nvmrc`, then `npm ci`. Run `npm run lint`, `npm run typecheck`, `npm test`, `python3 -m unittest discover -s scripts/tests`, `npm run build`, `npm run test:e2e` and `npm run test:app`. For native development, `npm run build:ios`, generate the Xcode project from `ios/App/project.yml` using XcodeGen, and open it on a Mac with the current accepted Xcode. The repository's iPhone workflow performs native tests and device archiving.

Migrations 001–008 are installed in the dedicated project; do not rerun them. Account credentials, signing material and Apple upload keys never belong in project attachments or public hosting.

## Complete workout builder update

Build 7 adds private saved workout templates, ordered drill previews and Owner assignment. Saved-template changes do not silently replace assigned snapshots. See [WORKOUT-GUIDE.md](WORKOUT-GUIDE.md) for scope and acceptance steps. Build 7 is verified available in Owner Testing. Try Content → Build a complete workout, save a protected session, preview its assignment to an eligible approved adult pilot account, and complete it in the saved order. Physical iPhone acceptance is still required; browser/simulator checks do not prove actual device usability.
