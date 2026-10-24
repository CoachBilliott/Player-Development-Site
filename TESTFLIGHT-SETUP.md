# Player Development iPhone testing

## Available now

**Player Development Test — 0.1.0 (4)** is uploaded, processed **VALID**, and **IN_BETA_TESTING** in the existing **Owner Testing** internal group. Apple verified this state on October 24, 2026. The group includes builds 4 and 3 and has access to all builds. Open the existing TestFlight invitation/app and tap **Update**. No new code, certificate installation or purchase is needed.

- [App Store Connect → TestFlight](https://appstoreconnect.apple.com/apps/6826677846/testflight/ios)
- [Signed upload evidence](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40137134573)
- [Native simulator/device build](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40136275504)
- [Web/client checks for the binary's source](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40136275540)
- [Apple processing and group verification](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40137645286)

The signed app contains the same JavaScript verified on the deployed website. Its source commit is `c9ed444b906dc8018bb77b82ef4d48395ccb09ee`. Subsequent backend assignment cleanup does not change that binary.

## Accounts and training

The app opens private account login. The public sample demo remains on the website; app demo routes are blocked. Existing owner email verification and Owner access are confirmed. The user chooses their own password. First-time Parent/adult Athlete setup describes the account's personal training profile and preserves existing staff permissions.

Upload an original or licensed drill through Content. An Owner then assigns protected workouts to a verified account and can separately enable video review with an assigned coach. Real plans do not contain built-in demo drills. See [the workout/video guide](VIDEO-REVIEW-GUIDE.md) for recording, previewing, private submissions, parent approval, coach feedback, quotas and deletion.

## Repeat builds and status checks

Bundle `com.coachbilliott.playerdevelopment`, team `4T6V3S3CZL`, App Store Connect app `6826677846`. Membership, App ID, app record, certificate/profile and upload credentials are already configured. Do not repeat enrollment or create another app record.

The manual **Signed iPhone build and optional TestFlight upload** workflow uses Xcode 26.3. It requires successful Prototype checks and iPhone simulator tests for the exact main commit, imports the dedicated signing material only after dependencies/build steps, validates the certificate/profile match and removes temporary private files afterward. Build 4 has already reached Apple; use a new build number for another upload. Upload is off by default. Only the signed IPA is retained, without private signing keys.

The **Check Apple TestFlight status** workflow reads processing/beta status and each app group's assigned build numbers. Default mode is read-only. The legacy optional encryption update is restricted to reviewed build 3 and was denied with HTTP 403. Build 4 instead declares `ITSAppUsesNonExemptEncryption=false` in its Info.plist for standard HTTPS/iOS security use; Apple confirmed it without another owner compliance step.

Configured repository secrets are `PD_IOS_SIGNING_BUNDLE_JSON`, `PD_ASC_KEY_ID`, `PD_ASC_ISSUER_ID` and `PD_ASC_PRIVATE_KEY_P8`. Keep their values in secure GitHub settings, never chat, source, screenshots or public hosting. The integration cannot manage Actions secrets; no broader token/key permission was requested. Private local signing files remain ignored and excluded from source/static downloads.

## What still needs owner/device work

Physical-iPhone camera capture, MOV/HEVC playback, microphone permissions, real Storage API upload/deletion, background/interrupted uploads and updates need acceptance testing with approved adults/fictional profiles. Simulator and browser checks do not prove these hardware paths. See [APP-TESTING.md](APP-TESTING.md).

The partner can use external TestFlight testing after genuine beta feedback/review contact fields, approved adult review-account access, an invitation address and Apple's beta review are completed. Do not grant administrative access just to test. No external beta submission or public App Store release was made. TestFlight builds expire after 90 days.

Public signup, payments and real junior enrollment/media remain closed. Public launch additionally needs accurate privacy/retention and full account-deletion processes, qualified guardian consent before opening juniors, training review, physical-device acceptance and package/billing implementation. No final pricing or guaranteed coaching/recruiting outcome is represented.
