# Player Development app testing

The native iPhone app **0.1.0 (5)** is available in the existing **Owner Testing** TestFlight group. Open TestFlight → Player Development Test → Update. The public website is [live here](https://coachbilliott.github.io/Player-Development-Site/); its one customer demo stays on the website. The browser app preview is `?source=app#app` and is separate from installing the native TestFlight binary.

## What works

- Verified private account login and iOS Keychain session storage; Owner/Manager/Coach and Parent/Athlete permissions remain separate.
- Real account plans use only assigned, published protected workouts matching the athlete's age, position and experience. No demo profiles or drills are imported.
- Today, Workouts, Progress and Account for customers. Staff use their authorized content and video review tools.
- A focused drill screen with the attached demonstration, visible instructions, equipment and cue, then Complete drill / Finish workout. Only submitting practiced work creates a participation report.
- Optional private video review: Record/Choose → Preview → Send; server access checks; family approval before linked-athlete clips reach the coach; private feedback and confirmed clip deletion. See [VIDEO-REVIEW-GUIDE.md](VIDEO-REVIEW-GUIDE.md).
- Owner account controls assign workouts and review access separately. Withdrawal/deletion prunes obsolete workout assignments without deleting existing video feedback.

Manual pilot permissions do not represent a subscription or payment. Real junior enrollment and video uploads remain closed. Activities await qualified coaching review; reports, parent approvals and feedback do not prove athletic improvement.

## Automated and live verification

The signed binary's source `2cf24b62cc3bc0c21a6d255a66cf4e29d8361f57` passed lint, type checking, production build, **123 unit/SQL policy tests, 132 desktop/phone browser tests, 8 installed-web-app tests, 10 Python signing tests and 3 native simulator tests**. Staff regression cases cover Owner/Manager/Coach accounts with no household record, slow permission lookup, refresh, no customer-setup flash, zero household reads/writes, password setup/cancellation, sign-out, and permission failure/retry. The website's 10 deployed staff-flow checks also pass with fictional intercepted backend responses. No account roles or database policies were changed by the staff UI correction.

The native tests ran on iPhone 17 Pro / iOS 26.2 with Xcode 26.3: assets/font/native bridge and Keychain round-trip, no native demo entry or legacy demo route access, private login/navigation and relaunch. They do not claim native camera/upload testing.

Live database tests use fictional adult identities inside a rolled-back transaction: matched assignments, private video authorization, assigned-coach-only access, profile isolation, idempotent finalization, feedback, cleanup guards, withdrawal assignment cleanup and feedback retention. No real videos/children or persistent fixture accounts were created. Anonymous REST/Storage requests were denied. The real Storage API upload/deletion path remains a physical-device acceptance item; live SQL tests use metadata fixtures, not uploaded objects.

The deployed website HTML and JavaScript/CSS hashes match the tested build. Another 16 deployed phone/desktop flow checks use intercepted fictional backend responses; media playback, recording-input setup, preview/cancel, retry/repeated send, coach feedback, deletion and package-access controls passed. No customer data was written by those browser tests. The signed IPA passed ZIP integrity, bundle/version/build, embedded verified profile, signature presence, no-private-keys and deployed-JavaScript-match checks. Apple reports VALID processing and IN_BETA_TESTING for build 5 in Owner Testing.

## First physical-iPhone acceptance

Use fictional profiles or approved adult pilot accounts only.

1. Update to build 4, launch from the icon, confirm there is no app demo entry, sign in/out, relaunch and check account isolation. Staff should see their staff account directly, with no Parent/Athlete choice. Parent/Athlete setup applies to customer training accounts.
2. Upload an original adult/noncontact drill, publish protected, and assign it to the test account. Start a workout, play its demonstration, read instructions, complete practice and check history after relaunch. Cancel an unfinished workout and confirm no practice report appears.
3. Enable review access and select a coach. Test camera/microphone/photo prompts, recording a short adult/fictional clip, saved MOV/MP4 selection, canceling the camera/picker, preview playback and explicit Send. Test a clip over 60 seconds/40 MB, unsupported/corrupt media and selecting the same file again.
4. Test a failed connection/retry, repeated Send taps, background/resume and app termination during upload. An unfinished upload must remain labeled unfinished; it is not a successful review submission. Clean it up from video history if necessary.
5. Check only the authorized family and assigned coach can open the clip; linked-family athlete clips need parent approval. Save feedback and verify it after relaunch. Cancel deletion, then delete permanently and confirm history/storage cleanup. Delete clips before removing their profile data.
6. Check 320px-equivalent layouts, large text, VoiceOver, keyboard, safe areas, rotation and native video fullscreen controls. Run the same flow on the partner's iPhone after their TestFlight access is ready.

Report device/iOS version, build number, screen, steps, expected/actual behavior. Do not include credentials or actual children's media in recordings/issues.

## Run locally

Use Node from `.nvmrc`, then `npm ci`. Run `npm run lint`, `npm run typecheck`, `npm test`, `python3 -m unittest discover -s scripts/tests`, `npm run build`, `npm run test:e2e` and `npm run test:app`. For native development, `npm run build:ios`, generate the Xcode project from `ios/App/project.yml` using XcodeGen, and open it on a Mac with the current accepted Xcode. The repository's iPhone workflow performs native tests and device archiving.

Migrations 001–007 are installed in the dedicated project; do not rerun them. Account credentials, signing material and Apple upload keys never belong in project attachments or public hosting.
