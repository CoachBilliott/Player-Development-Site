# Player Development iPhone testing

## Available now

**Player Development Test — 0.1.0 (8)** is uploaded, processed **VALID**, and **IN_BETA_TESTING** in the existing **Owner Testing** internal group. Apple verified this state for the released build. The group includes build 7 and has access to all builds. Open the existing TestFlight invitation/app and tap **Update**. No new code, certificate installation or purchase is needed.

- [App Store Connect → TestFlight](https://appstoreconnect.apple.com/apps/6826677846/testflight/ios)
- [Signed upload evidence](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40155199436)
- [Native simulator/device build](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40154383696)
- [Web/client checks for the binary's source](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40154383519)
- [Apple processing and group verification](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40155795825)

The signed app contains the same JavaScript verified on the deployed website. Its source commit is `ac21f6d4e23adf81768105c4537e8f3191c6cd8d`. New shared uploads support explicit device drafts and editable coaching details. Guided practice shows the session order, next drill and previous drill. Build 7 adds named ordered workouts and Owner-only whole-session assignment. See [WORKOUT-GUIDE.md](WORKOUT-GUIDE.md) for eligibility, snapshot versions and the one-current-workout-per-account scope. Staff account settings are separate from customer household setup. Owners, Managers and Coaches do not need a Parent/Athlete profile to open their management tools.

## Accounts and training

The app opens private account login. The public sample demo remains on the website; app demo routes are blocked. Existing owner email verification and Owner access are confirmed. The user chooses their own password. Owners, Managers and Coaches open their staff account tools directly; customer Parent/Athlete setup is not shown to staff.

Upload an original or licensed drill through Content. An Owner then assigns protected workouts to a verified account and can separately enable video review with an assigned coach. Real plans do not contain built-in demo drills. See [the workout/video guide](VIDEO-REVIEW-GUIDE.md) for recording, previewing, private submissions, parent approval, coach feedback, quotas and deletion.

## Repeat builds and status checks

Bundle `com.coachbilliott.playerdevelopment`, team `4T6V3S3CZL`, App Store Connect app `6826677846`. Membership, App ID, app record, certificate/profile and upload credentials are already configured. Do not repeat enrollment or create another app record.

The manual **Signed iPhone build and optional TestFlight upload** workflow uses Xcode 26.3. It requires successful Prototype checks and iPhone simulator tests for the exact main commit, imports the dedicated signing material only after dependencies/build steps, validates the certificate/profile match and removes temporary private files afterward. Build 5 has already reached Apple; use a new build number for another upload. Upload is off by default. Only the signed IPA is retained, without private signing keys.

The **Check Apple TestFlight status** workflow reads processing/beta status and each app group's assigned build numbers. Default mode is read-only. The legacy optional encryption update is restricted to reviewed build 3 and was denied with HTTP 403. The current app declares `ITSAppUsesNonExemptEncryption=false` in its Info.plist for standard HTTPS/iOS security use; Apple confirmed it without another owner compliance step.

Configured repository secrets are `PD_IOS_SIGNING_BUNDLE_JSON`, `PD_ASC_KEY_ID`, `PD_ASC_ISSUER_ID` and `PD_ASC_PRIVATE_KEY_P8`. Keep their values in secure GitHub settings, never chat, source, screenshots or public hosting. The integration cannot manage Actions secrets; no broader token/key permission was requested. Private local signing files remain ignored and excluded from source/static downloads.

## What still needs owner/device work

Physical-iPhone camera capture, MOV/HEVC playback, microphone permissions, real Storage API upload/deletion, background/interrupted uploads and updates need acceptance testing with approved adults/fictional profiles. Simulator and browser checks do not prove these hardware paths. See [APP-TESTING.md](APP-TESTING.md).

The partner can use external TestFlight testing after genuine beta feedback/review contact fields, approved adult review-account access, an invitation address and Apple's beta review are completed. Do not grant administrative access just to test. No external beta submission or public App Store release was made. TestFlight builds expire after 90 days.

Public signup, payments and real junior enrollment/media remain closed. Public launch additionally needs accurate privacy/retention and full account-deletion processes, qualified guardian consent before opening juniors, training review, physical-device acceptance and package/billing implementation. No final pricing or guaranteed coaching/recruiting outcome is represented.
