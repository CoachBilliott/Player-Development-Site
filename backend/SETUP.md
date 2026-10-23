# Player Development backend — private adult pilot

The dedicated project `iilbulpqbuknhdpmtrvm` is connected. Migrations `001-shared-content.sql` and `002-private-profiles.sql` were applied once and verified against the live project. Do not rerun the initial migrations against this installed schema.

The site URL and exact verification/recovery redirect URLs point to `https://coachbilliott.github.io/Player-Development-Site/`. Email confirmation is required and passwords require at least 12 characters. Management access is supplied securely by the owner; no administrative credential belongs in the repository, browser configuration, test fixtures or chat.

## Current enrollment scope

`enabled` and `membersEnabled` connect the member area. `membersSignupEnabled: false` closes the public signup interface, and Supabase Auth `disable_signup: true` closes the signup API after the initial owner activation request. Existing pilot accounts can sign in and recover their password. This is a private adult-profile pilot, not general public enrollment.

`profile_settings.under18_enabled` remains false in the live database. The database rejects under-18 profiles even if someone bypasses the interface. Appropriate verified parental consent, privacy/retention review and a support contact are still required before opening children's enrollment. Adult ownership is self-attested. Use fictional player nicknames while testing.

Supabase's built-in email sender is restricted and rate limited. The owner approved one activation-email test. A successful send request is not proof of inbox delivery or completed activation. Before public enrollment, configure an owner-controlled SMTP sender, verify delivery/recovery on physical devices and complete privacy/support review. No SMTP provider or paid plan has been purchased.

## Verification performed

- Live project identity and public Auth endpoint checked using the owner's supplied connection.
- All five public tables have row-level security enabled. Anonymous REST reads can access published training but receive permission-denied responses for member accounts and profiles.
- Live transaction tests create only fictional temporary adult Auth/profile fixtures, exercise owner create/read/edit/version checks and cross-household read/write/delete rejection, reject account-type escalation and under-18 creation, and roll back every fixture. The cleanup check confirms zero remaining test users.
- Browser tests intercept fictional backend responses and never use the owner's live project. They cover the actual SDK, email callbacks, private-profile CRUD and account switching. Local/hosted checks and actual public deployment must still be confirmed for each release.
- Provider-issued activation/invitation/recovery links may use an implicit email callback. The app removes tokens from the URL and validates the session through Supabase Auth before showing account controls. Browser-initiated signup/recovery continues to use PKCE and requires the same browser for the callback.

## Opening public registration later

1. Finish the live email, privacy/retention/support and physical-device checks below. Keep children's enrollment closed until a verified guardian-consent process is implemented.
2. Configure a permitted SMTP sender and provider abuse/rate controls. Review current free-plan limits, inactivity behavior and terms without enabling paid billing automatically.
3. Set Supabase Auth `disable_signup` to false and website `membersSignupEnabled` to true only when adult public enrollment is approved. This interface flag is not a security boundary; server Auth and database policies remain authoritative.
4. Review and deploy the configuration through this repository's existing Pages route. Confirm the actual live URL and a real verification/recovery journey before describing signup as launched.
5. Grant coach access only through privileged owner administration by inserting the approved adult's Auth UUID into `public.coach_members`. It does not grant access to other households' player data. Do not grant roles from signup metadata.

## What is implemented

- Adult email/password signup, email-verification callback, sign-in, password recovery/change and browser sign-out, using one shared Supabase Auth client with PKCE.
- Empty, private member accounts with a parent/legal-guardian or adult-player type. The server requires verified email and explicit adult/privacy acknowledgements; browser users cannot alter account types or consent timestamps.
- Private player create/edit/delete, parent-managed under-18 profiles after server enrollment opens, age-band/position/experience/goal preferences, stable creation IDs, server version checks and lost-response confirmation.
- Adult-player accounts can only create adult profiles. There are no child logins, public profiles, messaging or implicit coach access to player data.
- Profiles are fetched online into memory. Only the authentication session persists locally; member profiles are not placed in demo localStorage, IndexedDB, the service worker cache or offline pages. Identity changes clear the member view, including cross-tab sign-out.
- Member profile-data deletion cascades through that household's players. **The Auth email login remains**; full login erasure and provider backup retention require the project owner. The interface explicitly explains this difference. No hidden payment relationship is created.
- Shared coach media publish/edit/replace/delete, explicit coach allowlist, public published sample reads, private media bucket with one-hour signed links, 12 MB/type limits and optimistic versions.
- The existing fictional profiles, local uploads and demo practice history remain separate and never import into member accounts.

## Live acceptance before activation

Use fictional adult test identities only. Do not enter real children's information during this pilot.

- Verify that signup sends a usable confirmation email, unverified users cannot complete member setup, wrong credentials fail, and expired/cross-browser callback links show a recoverable error. Verify fresh recovery emails, password changes, sign-out, token expiry and provider rate limits. A simulated API test cannot prove delivery.
- Create parent and adult-player test accounts. Create, edit, refresh and delete fictional adult profiles across two devices. Check a cancelled edit/delete, rapid save taps, a dropped response, stale edit versions and failure recovery. Switch accounts and sign out in another tab; no prior household profile may remain visible or be returned by REST.
- With the public key and unrelated authenticated account, explicitly attempt to read a known other household ID, change ownership, rewrite consent/type, grant coach access or open under-18 enrollment. All must fail. Verify under-18 create/update is rejected while the server setting is false. Under-18 positive tests require fictional fixtures in a controlled environment only.
- Delete one account's member data and confirm its player rows disappear while the second household and Auth login remain. Complete full Auth erasure through the provider dashboard when requested; define support, retention, backup and restore procedures.
- For shared publishing, an approved coach uploads original sample media, publishes, edits/replaces/removes it; a separate visitor sees published changes after refresh. Anonymous and non-coach requests cannot write, access drafts or upload storage objects. Check file size/type enforcement and stale versions. Audit orphan-file cleanup. Malware scanning/content inspection and moderation are not implemented.
- On real iPhone Safari and Android Chrome, check signup keyboard/layout, email-link handoff to the same browser, recovery, file uploads/playback, installed-app sign-in, refresh, offline status and updates. Automated Chromium phone emulation does not replace these checks.

## Still outside this activation

Payments, package definitions, recurring billing, unpaid-access suspension, entitlement enforcement, real member practice-history sync, native App Store/Play Store apps, verified guardian identity and reviewed real training prescriptions are not implemented. The current training remains illustrative and pending qualified review. No pricing, player allowance, scholarship or recruiting outcome is promised.
