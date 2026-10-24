# Player Development: native iPhone testing through TestFlight

The selected distribution route is TestFlight for the owner and partner. The native iOS client is built and simulator-tested. There is not yet a signed iPhone download or a TestFlight invitation. The owner reports paying for Apple membership and has supplied Team ID **4T6V3S3CZL**, now recorded in both Xcode project configurations and `ios/testflight.json`. Apple account access and membership activation have not been independently verified. No Apple account security settings have been changed.

## Confirm enrollment on your iPhone

Payment has already been reported. Do not repeat the purchase: check the Account tab for Apple’s membership activation first. The enrollment steps below remain as a reference.

1. Install the official [Apple Developer app](https://apps.apple.com/app/apple-developer/id640199958).
2. Open its Account tab and sign in to the Apple Account that will own Player Development. Follow Apple's enrollment flow. [Apple's instructions](https://developer.apple.com/help/account/membership/enrolling-in-the-app/) also explain eligibility and identity verification; [web enrollment](https://developer.apple.com/programs/enroll/) is another supported route.
3. Choose the correct ownership type. Individual/sole-proprietor enrollment lists your personal legal name as the App Store seller. Eligible Organization enrollment lists the legal entity's name and requires Apple's business verification, including a D-U-N-S number. A brand name alone is not a legal entity. [Compare the requirements](https://developer.apple.com/support/enrollment/).
4. Complete Apple's identity verification, agreement and membership purchase yourself. Apple lists US$99 per membership year; local pricing varies. Apple requires two-factor authentication for the account. Any account security changes must be completed by the owner through Apple.
5. Wait until Apple confirms the membership is active. Creating an Apple Account or starting enrollment does not activate TestFlight distribution.
6. Both testers can install the free [TestFlight app](https://apps.apple.com/app/testflight/id899247664) now. Player Development will appear after a valid invitation and an available build; installing TestFlight alone does not install this app.

The Team ID has been received; it is an identifier, not a signing credential. Passwords, verification codes, certificates/private keys and App Store Connect API keys must not be posted in chat or committed to this public repository.

## Prepared signing/upload workflow — not yet run

`.github/workflows/testflight.yml` is a manual workflow for a signed iPhone build and an optional App Store Connect upload. It accepts only `main` after both the normal checks and iPhone simulator tests pass for the exact commit. Upload is off by default. Signing uses the dedicated team's manually supplied App Store profile and Apple Distribution certificate; it does not automatically create/revoke credentials, register devices, create an app record, invite testers or publish an App Store release.

The profile validator rejects a different team, different/wildcard app identifier, expired profile, non-iOS profile and development/ad-hoc/enterprise signing. Temporary keys are removed from the runner at job end. Only the signed app is retained as an artifact; it contains normal embedded public signing metadata, not the private certificate key or Apple API key. That artifact is not a TestFlight invitation or a directly installable App Store release.

After owner authorization, provision these **repository Actions secrets** through [GitHub's secure settings](https://github.com/CoachBilliott/Player-Development-Site/settings/secrets/actions):

| Secret | Required value |
| --- | --- |
| `PD_IOS_DISTRIBUTION_P12_BASE64` | Base64 of the dedicated Apple Distribution certificate export, including its private key. |
| `PD_IOS_P12_PASSWORD` | Password protecting that encrypted certificate export. |
| `PD_IOS_APPSTORE_PROFILE_BASE64` | Base64 of the valid App Store distribution profile for this team and bundle ID. |
| `PD_ASC_KEY_ID` | App Store Connect team API Key ID, for uploads. |
| `PD_ASC_ISSUER_ID` | The corresponding App Store Connect API Issuer ID. |
| `PD_ASC_PRIVATE_KEY_P8` | The API private key's original PEM text, for uploads. |

The first three are needed for a signed build; the API fields are needed only when upload is explicitly selected. Use a role Apple permits for uploading this app, with the least necessary access; this upload workflow does not need permission to manage certificates or profiles. Registering the bundle/app record and creating the signing assets are separate owner-authorized steps. Do not use credentials belonging to unrelated projects.

The current repository integration can push code and run builds, but its requests to list Actions secrets/variables returned **403 Resource not accessible by integration**. Existing secret names/values could not be verified. Secret setup therefore requires the owner's authenticated GitHub settings; no new personal access token or expanded integration permission has been requested. No secret values are present in these files.

When those prerequisites are ready, run **Signed iPhone build and optional TestFlight upload**, choose a unique positive build number (1–9999), and leave upload off for the first signed-build verification. For an authorized upload, select the upload option with a new build number. After an accepted upload, check Apple's processing status, beta requirements/review and invitations. Avoid re-running an already uploaded build number. An upload success message alone does not mean the app can be installed by testers.

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
