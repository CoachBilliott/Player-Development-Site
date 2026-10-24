# Player Development: native iPhone testing through TestFlight

The selected distribution route is TestFlight for the owner and partner. The native iOS client is built and simulator-tested. There is not yet a signed iPhone download or a TestFlight invitation. Apple membership, signing and App Store Connect setup remain required. The owner reports paying for Apple membership; activation and the owning Team ID have not yet been verified. No Apple account security settings have been changed.

## Confirm enrollment on your iPhone

Payment has already been reported. Do not repeat the purchase: check the Account tab for Apple’s membership activation first. The enrollment steps below remain as a reference.

1. Install the official [Apple Developer app](https://apps.apple.com/app/apple-developer/id640199958).
2. Open its Account tab and sign in to the Apple Account that will own Player Development. Follow Apple's enrollment flow. [Apple's instructions](https://developer.apple.com/help/account/membership/enrolling-in-the-app/) also explain eligibility and identity verification; [web enrollment](https://developer.apple.com/programs/enroll/) is another supported route.
3. Choose the correct ownership type. Individual/sole-proprietor enrollment lists your personal legal name as the App Store seller. Eligible Organization enrollment lists the legal entity's name and requires Apple's business verification, including a D-U-N-S number. A brand name alone is not a legal entity. [Compare the requirements](https://developer.apple.com/support/enrollment/).
4. Complete Apple's identity verification, agreement and membership purchase yourself. Apple lists US$99 per membership year; local pricing varies. Apple requires two-factor authentication for the account. Any account security changes must be completed by the owner through Apple.
5. Wait until Apple confirms the membership is active. Creating an Apple Account or starting enrollment does not activate TestFlight distribution.
6. Both testers can install the free [TestFlight app](https://apps.apple.com/app/testflight/id899247664) now. Player Development will appear after a valid invitation and an available build; installing TestFlight alone does not install this app.

After activation, the useful next details are the Apple Team ID and whether enrollment is Individual or Organization. The Team ID is an identifier, not a signing credential. Passwords, verification codes, certificates/private keys and App Store Connect API keys must not be posted in chat or committed to this public repository.

## What is already prepared

- Native source: `ios/`, with the shared React/TypeScript training client and Capacitor integration.
- Provisional bundle identifier: `com.coachbilliott.playerdevelopment`.
- Temporary app name: Player Development; version 0.1.0.
- Original app icon, launch screen, mobile navigation, bundled sample training, Keychain session storage and lifecycle handling.
- Passed native checks: Keychain round-trip, bundled photo/font, guided workout completion and saved report, family roster after relaunch, and sign-in/help navigation. These checks run in an iPhone simulator, not physical iPhones. The build workflow selects Xcode 26.3 and the newest available iPhone simulator runtime.
- Passed web/client checks: lint, type checking, production build, 100 unit tests, 110 browser tests and 8 installed-web-app tests.
- [Native build/test evidence](https://github.com/CoachBilliott/Player-Development-Site/actions/workflows/ios-build.yml).

The existing simulator app runs on compatible Macs. The unsigned device archive is compilation evidence and cannot install on an iPhone or be uploaded as a TestFlight release. Distribution needs a fresh signed archive built with Apple's currently accepted Xcode/iOS SDK and a unique build number.

## Remaining distribution work after enrollment

1. Confirm the owning Apple team, temporary app name and bundle identifier before registering the app. The bundle identifier connects the signing configuration to the App Store Connect record.
2. Register the identifier and create the iOS app record in App Store Connect under that team. This does not publish the app to the App Store.
3. Choose and authorize the signing/upload method. Configure required credentials in secure storage, never this public source tree. Any new credentials or account security changes require owner authorization before setup.
4. Build, test and sign a distribution archive with the current accepted Apple toolchain; validate and upload it to App Store Connect. The current workflow builds/test archives but does not sign or upload a TestFlight release.
5. Complete accurate beta details, review contact information and encryption/export-compliance answers. Use [the beta review draft](TESTFLIGHT-BETA-NOTES.md) as a starting point; owner-only fields remain unfilled.
6. Add the owner as an eligible internal tester. Invite the partner as an external tester unless they independently need App Store Connect access. External testing may require Apple's beta review, especially the first build. Do not grant administrative access just to test the app.
7. Verify the invitations open in TestFlight on both physical iPhones and the installed build launches. An upload or successful build alone is not a working invitation. TestFlight builds expire; subsequent test builds require a new upload/build number.

## First physical-device test

Use fictional sample profiles. Test installing/updating, launching from the icon, the single Parent & family / Solo athlete demo, workout completion, saved history after relaunch, offline samples, keyboard and safe areas, text scaling, background/resume and cancellation. With approved adult pilot accounts, separately test real sign-in/logout, password/email handoff through the website, role isolation and staff file picking/uploads. Do not put actual credentials into a screen recording or issue report.

The beta is invite-only and illustrative. Public signup, payments and real junior enrollment remain closed. Public launch additionally requires privacy and authentication-account deletion work, verified guardian consent before opening juniors, qualified training review, physical-device acceptance and package/billing implementation. Store or beta approval is Apple's decision.
