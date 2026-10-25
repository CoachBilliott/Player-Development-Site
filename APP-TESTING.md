# Player Development app testing

The native iPhone app **0.1.0 (11)** is verified **VALID / IN_BETA_TESTING** in the existing **Owner Testing** TestFlight group. Open TestFlight → Player Development Test → Update and confirm build 11. [Website](https://coachbilliott.github.io/Player-Development-Site/) · [Browser app preview](https://coachbilliott.github.io/Player-Development-Site/?source=app#app). The one fictional customer demo stays on the website; it is not inserted into private accounts.

## Private invitations and full customer deletion in build 11

Owners can prepare adult Parent/Athlete/Coach/Manager invitations, review their delivery/acceptance state and cancel pending access. Recipients verify their email, choose their own password and accept exactly the intended role with adult/pilot privacy acknowledgements. Cancelled/expired invitations cannot fall through into ordinary setup. Staff do not choose Parent/Athlete to enter management tools. Existing verified, unconfigured accounts can receive setup approval without another email. TestFlight access remains separate.

Customers can review full account deletion, re-enter their current password and type DELETE. The server verifies that password-authenticated identity, pauses access, removes scoped private clips/data and deletes the email login. Interrupted cleanup remains frozen and retryable; other households remain intact. Owners, staff/content owners and guardian-managed identities request assisted review. Marking review does not claim deletion or bypass ownership/consent safeguards.

**Email delivery is not launch-ready:** this project has no custom SMTP sender. The invitation UI and server handle setup failures honestly; a dedicated sender/address/provider and real delivery acceptance are still needed. No real invitation emails were sent by development tests. See [ACCOUNT-LIFECYCLE.md](ACCOUNT-LIFECYCLE.md) and [public account help](https://coachbilliott.github.io/Player-Development-Site/account-help.html).

Migration 010 and the protected account service are installed and verified. A real API acceptance used two temporary fictional adult customers and original test clips: the first account's login/profile/Storage object were erased while the second household remained intact; the deleted login and old token were rejected. Both synthetic customers and coach were removed, restoring the original user/profile/Owner/clip counts. Public signup, child gates, billing and existing Owner access were preserved. A preceding rolled-back rehearsal also verified invitation activation and private RPC/table access. No real customer data was erased. Final privacy/support and retention policies, staff/guardian operator processes and physical iPhone email handoff still require their launch work.

## Training workflow retained from build 10

1. **Prepare iPhone videos.** Choose a Photos clip, select its range, and prepare a smaller H.264 MP4 with actual progress. MOV/HEVC export is tested. Native preparation targets 12 MB; staff drill clips allow up to 180 seconds. Ordinary attachments allow 40 MB. Actual Storage transfers show progress and failures preserve the draft for retry. Originals remain in Photos. See [UPLOAD-GUIDE.md](UPLOAD-GUIDE.md).
2. **Connect approved drills to workouts.** From Drafts & approvals, choose Build a workout with this drill, arrange the complete session, preview and save. An Owner assigns the saved version to an eligible approved adult customer account. Existing work supports one current workout per customer account, not a multiweek calendar. See [WORKOUT-GUIDE.md](WORKOUT-GUIDE.md).
3. **Resume unfinished practice privately.** Save & leave workout, reopen/refresh and Resume workout at the saved drill. Server checks access, content and assignment versions; conflicting or changed instructions require refreshing. Saved places expire after seven days and are removed when checked. Pausing/watching never creates history. Completion uses the same session ID and clears saved practice atomically.
4. **Approve shared content explicitly.** Draft → Awaiting review → Approved; Owner/Manager can request changes or approve. Coaches submit their own content and cannot approve. Editing approved instructional content returns it to draft and withdraws affected training until reapproval and explicit reassignment. Internal review notes are staff-only. Server grants and checked RPCs enforce these rules. Approval is separate from qualified coaching review.
5. **Run the two-phone acceptance guide.** [Phone-readable guide](https://coachbilliott.github.io/Player-Development-Site/phone-test.html) · [Two-page PDF](https://coachbilliott.github.io/Player-Development-Site/phone-test.pdf) · [Repository checklist](PHONE-ACCEPTANCE.md). Allow 15–20 minutes with an Owner phone, a separate approved adult customer account and an original adult noncontact clip.

The simplified staff/customer layout and matching 8-character password rule remain from build 8: uppercase, lowercase, number and special character. Existing passwords are unchanged. Staff accounts open their own workspace without Parent/Athlete setup. See [APP-DESIGN.md](APP-DESIGN.md) and [PASSWORD-POLICY.md](PASSWORD-POLICY.md).

## Verified release

Source `82fc087d7f27605a8f6215b0df9a5c3e9cf178ad` passed lint, types, production build, **219 unit/database-policy tests, 196 desktop/phone browser tests, 8 installed-web-app checks, 10 signing tests and 6 native simulator tests**. [Clean web checks](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40222317749) · [iPhone tests/archive](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40222318062) · [Signed upload](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40223131600) · [Apple processing/group verification](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40223522807).

Native tests use iPhone 17 Pro / iOS 26.2 and Xcode 26.3. They include actual H.264 MOV trim/export and original generated HEVC-to-H.264 conversion, app-bundled timestamp privacy declaration, plugin bridge, assets, Keychain and private login/navigation. The video fixture is an original one-second black frame with no people or audio, not a coaching demonstration.

Another **34 checks on the actual deployed website** used intercepted fictional backend responses for approval, workout assignment, saved practice, canceled/repeated actions, failure/retry and phone layouts. Actual HTTPS HTML/JavaScript/CSS and both phone guides match the built files. Signed IPA verification checks ZIP integrity, bundle/build, team/profile, signature resources, absence of private signing keys, matching web assets and the app-container timestamp privacy reason C617.1.

Migration 009 was applied once to the dedicated project, following a rolled-back live acceptance transaction with fictional adults. It adds staff approval/audit, private practice resumes and MOV/40 MB shared-attachment support. Live checks confirmed household isolation, approval restricted to Owners/Managers, review-note isolation, ordered assignments, idempotent completion and atomic resume cleanup. Anonymous resume/review calls were denied. No real customer fixtures, media, assignments or emails were retained. Migrations 001–010 are installed; do not rerun them. Junior enrollment and child self-access gates remain closed.

Build 10 added the video timestamp privacy manifest; build 11 retains it and adds the account lifecycle controls. No further certificate/profile installation is needed.

## What still needs your phones and launch decisions

Run [PHONE-ACCEPTANCE.md](PHONE-ACCEPTANCE.md) on actual devices. Simulator/browser tests do not establish Photos selection, actual capture/microphone permissions, recording orientation/audio, real Storage transfer/deletion, interrupted/background behavior or hardware usability. Keep the app open while preparing/uploading. Device upload drafts are account-keyed local IndexedDB and do not sync; shared drafts and saved practice use the private backend. No durable background-upload guarantee is offered.

Use original or licensed adult pilot content and approved adult accounts only. Real junior access/media, public signup, payments and public App Store release remain closed. Staff approval does not replace qualified coaching review, content rights or safeguarding. Reports and feedback record participation; they do not prove athletic improvement or guarantee recruiting/scholarship outcomes.

Public launch still needs business/package decisions, reviewed training content, accurate privacy/retention and complete account-deletion processes, guardian-consent work before opening juniors, billing implementation, device acceptance and Apple review metadata/reviewer access. No final pricing or live subscription is invented here.

## Run locally

Use Node from `.nvmrc`, then `npm ci`. Run `npm run lint`, `npm run typecheck`, `npm test`, `python3 -m unittest discover -s scripts/tests`, `npm run build`, `npm run test:e2e` and `npm run test:app`. For native development use `npm run build:ios`, XcodeGen with `ios/App/project.yml`, and an accepted Xcode on a Mac. Existing GitHub workflows run clean web checks, simulator tests, archive/signing/upload and read-only Apple status. Secrets never belong in source or public downloads.
