# Player Development: native iPhone testing through TestFlight

## Verified distribution status

Version **0.1.0 (3)** was signed, validated and uploaded successfully on October 24, 2026. Apple subsequently reported **VALID** processing for **Player Development Test**, App Store Connect app **6826677846**, bundle **com.coachbilliott.playerdevelopment**, team **4T6V3S3CZL**. [Successful upload](https://github.com/CoachBilliott/Player-Development-Site/actions/runs/40133012967).

The build is not yet installable through an invitation. Apple reports **MISSING_EXPORT_COMPLIANCE** for internal and external testing, no beta groups exist, and beta review contact fields are empty. An API attempt to record the encryption answer returned **HTTP 403**. Keep the current upload key permissions; the owner can complete the answer in App Store Connect. No tester invitations or beta review submissions have been sent.

## Next owner steps

1. Open [Player Development Test → TestFlight](https://appstoreconnect.apple.com/apps/6826677846/testflight).
2. Open **0.1.0 (3)** and **Manage** beside **Missing Compliance**. This reviewed binary uses HTTPS, iOS Keychain and standard Web Crypto authentication, with no proprietary encryption. It does not use non-exempt encryption. Answer Apple's questions for that behavior; signing/build tools and private keys are not embedded in the app.
3. For immediate owner testing, create an **Internal Testing** group, add the owning App Store Connect user and select build 3. Install the free [TestFlight app](https://apps.apple.com/app/testflight/id899247664), accept the invitation and install the build. Internal testers must already be eligible App Store Connect users; an external email address alone does not grant internal access.
4. For a partner who does not need App Store Connect access, use an **External Testing** group. Complete genuine beta feedback/review contact fields and use [the beta review draft](TESTFLIGHT-BETA-NOTES.md). Submit the first external build for Apple's beta review, then invite the partner. Do not grant administrative access just to test.
5. Confirm the invitation opens and the installed build launches on both physical iPhones. Upload success and valid processing do not prove installation or external beta approval.

No new purchase, API key or broader account permission is required to answer export compliance in the owner's existing account. Do not post passwords, private keys, signing bundles or review credentials in chat or this public repository.

## Repeatable build and status workflows

- **Signed iPhone build and optional TestFlight upload** (`.github/workflows/testflight.yml`) runs on macOS with Xcode 26.3. It requires `main`, successful Prototype checks and iPhone simulator tests for the exact commit, and a unique positive build number. Upload is off by default. Build 3 has already reached Apple; use a new number for the next uploaded binary.
- **Check Apple TestFlight status** (`.github/workflows/testflight-status.yml`) reads Apple processing state, internal/external beta state, group names and review-field presence. Its default mode is read-only. Its optional encryption update is restricted to reviewed version 0.1.0 build 3; Apple denied that update with the current key. Credentials and bearer tokens are never included in its status artifact.
- `scripts/prepare_signing_bundle.py` and `scripts/prepare_ios_signing.py` validate the dedicated team/app, original profile UUID, App Store distribution type, expiry and signing-certificate match. Temporary signing material is removed after each build. Retained IPA files contain normal public signing metadata, not private signing keys.

The owner configured these GitHub Actions secrets in [secure repository settings](https://github.com/CoachBilliott/Player-Development-Site/settings/secrets/actions):

| Secret | Purpose |
| --- | --- |
| `PD_IOS_SIGNING_BUNDLE_JSON` | Dedicated encrypted certificate export, password and provisioning profile |
| `PD_ASC_KEY_ID` | App Store Connect team API Key ID |
| `PD_ASC_ISSUER_ID` | App Store Connect API Issuer ID |
| `PD_ASC_PRIVATE_KEY_P8` | Complete original API private-key PEM text, including BEGIN/END lines |

These credentials have now worked for signing and upload. The repository integration cannot manage Actions secrets (HTTP 403); owner updates stay in GitHub's authenticated settings. No broader GitHub token is needed. Private workspace signing files are ignored and excluded from public downloads, Pages and source archives.

## Validation and first physical-device test

The uploaded binary's source passed lint, type checking, production build, 100 unit tests, 110 browser tests, 8 installed-web-app tests, 10 Python signing tests, and 3 iPhone simulator tests. Signed IPA integrity, bundle/version/build, embedded profile and absence of private credential files were verified. The status helper additionally passed lint, workflow validation and a local fake-API exercise verifying its ES256 JWT, exact reviewed-build update and response handling. Physical-iPhone tests remain pending installation.

Use fictional sample profiles to test installation/update, launching from the icon, the single Parent & family / Solo athlete demo, workout completion, saved history after relaunch, offline samples, keyboard/safe areas, text scaling, background/resume and cancellation. With approved adult pilot accounts, separately test real sign-in/logout, website email/password handoff, role isolation and staff file picking/uploads. Do not capture credentials in recordings or issue reports.

The beta is invite-only and illustrative. Public signup, payments and real junior enrollment remain closed. Public launch additionally needs privacy and account-deletion work, verified guardian consent before opening juniors, qualified training review, physical-device acceptance and package/billing implementation. Beta and store approval are Apple's decisions; TestFlight builds expire after 90 days.
