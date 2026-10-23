# Player Development backend activation

The website is live at https://coachbilliott.github.io/Player-Development-Site/. Its private member entry is `#account`; the fictional demo remains available without login. The owner supplied project URL `https://iilbulpqbuknhdpmtrvm.supabase.co`. Its connection, schema and email setup have not yet been verified. The project URL and owner-supplied public publishable key are recorded in the website configuration. Management access is not configured, and live connectivity has not been verified. The public configuration remains disabled. Signup and shared publishing are unavailable until the owner-controlled backend is connected.

## Owner-controlled project and access

Open https://supabase.com/dashboard and sign in or create an account. Create a **separate Player Development project on the available free plan**, reviewing its current limits and terms. Do not reuse Coach Workroom, Spawnative or an unrelated organization/project. Keep ownership in your or your partner's account. Do not enable paid billing. Creating an account requires your sign-in and may require email verification; this coding workspace cannot perform that owner interaction.

Passwords, database passwords, secret/service-role keys and personal access tokens must never be sent in chat or committed. The frontend needs only the project URL and public publishable key. Those public values alone do not authorize running database migrations. A signed-in owner must apply the migrations in the provider's SQL editor, or securely provision management access through the environment's credential settings for an authorized setup session.

## Pending cloud access review

A reusable cloud environment draft now preserves the existing GitHub destinations and proposes access to only `iilbulpqbuknhdpmtrvm.supabase.co` and `api.supabase.com`. It also declares a private `SUPABASE_ACCESS_TOKEN` requirement whose proxy destination is only `api.supabase.com`, plus the non-secret `PLAYER_DEVELOPMENT_SUPABASE_PROJECT_REF` value. No token value has been supplied or saved. The configuration draft is saved, but not applied/published; an HTTPS connection to the project was rejected by the current cloud proxy with CONNECT 403.

For the agent to install the database and configure Auth for you, review/save the environment changes, enter the management access token through secure environment credentials, and publish the environment. This is an administrative credential; the website's publishable key cannot install tables or change Auth settings. Never put a management token in this repository, the frontend configuration or chat. Use a token restricted to the required project/organization where the provider supports it, and revoke temporary setup access afterward. The agent must act only on project `iilbulpqbuknhdpmtrvm`, recheck runtime readiness and verify the service after access is applied. No database password or frontend service-role key is needed for this route.

An owner may instead run the two prepared migrations directly in the project's SQL editor and configure the Auth settings below. That avoids sharing administrative credentials. The public connection key does not prove that migrations, RLS or email delivery work, and registration must remain disabled until acceptance passes.

## Database and login setup

1. In the new, empty project's SQL editor, review and run `001-shared-content.sql`, then `002-private-profiles.sql`, once each. Neither is an update script for an unrelated database. Retain their output. The first creates coach permissions and shared media; the second creates private member accounts/profiles and enrollment settings. Actual PostgreSQL policy tests run locally; live service settings have not yet been tested.
2. Enable email/password signup **with email confirmation required**. Set a minimum password length of 12 or stronger. Enable available provider rate limits and abuse protection. Public signup creates no coach or admin role. Keep privileged Auth, database and Storage settings under owner control.
3. Set Site URL to `https://coachbilliott.github.io/Player-Development-Site/`. Allow these exact email redirect URLs:
   - `https://coachbilliott.github.io/Player-Development-Site/`
   - `https://coachbilliott.github.io/Player-Development-Site/?flow=recovery`
     The app uses the `#account` fragment for its screen. Verification and recovery use PKCE; open the email link in the same browser where signup/reset began. Never use a broad wildcard redirect for production. Keep the provider's confirmation/recovery templates using its standard confirmation URL.
4. Test email delivery to the owner and partner. Supabase's built-in sender is restricted and rate limited; it is not a general public enrollment email service. Before public registration, connect an owner-controlled SMTP provider permitted for your audience, verify its sender and delivery, and review any free-plan limits. No email provider has been purchased or configured here.
5. Provision the owner and partner as adult Auth users. If they will publish training, grant their verified Auth UUIDs through the provider SQL editor: `insert into public.coach_members(user_id) values ('REPLACE-WITH-APPROVED-AUTH-UUID');`. Never add this privilege based on a signup field or browser request. Coaches do not receive private player access.
6. Put the HTTPS Supabase project URL and **public publishable key** (or legacy anon key) in `public/content-config.json`. Set `enabled: true`. Leave `membersEnabled: false` during live acceptance. These values are public; secret/service-role keys are rejected by the client and must never appear here. Redeploy through this repository's existing Pages route. If the managed cloud network needs the exact project hostname allowed, use its supported configuration workflow.
7. Before enabling member registration, finish the live acceptance below, publish a reviewed privacy/retention policy and a working support contact, and confirm adult enrollment scope. Then set `membersEnabled: true`, run checks, and redeploy. This website flag controls the interface, not database authorization. Database row-level security is enforced independently.
8. **Under-18 enrollment starts closed at the database.** The migration creates `profile_settings.under18_enabled = false`. Do not open it for real children until qualified privacy/parental-consent review establishes an appropriate verified guardian-consent process. Self-attestation alone is not represented as verified consent. After that process is implemented and approved, an owner may run `update public.profile_settings set under18_enabled = true where singleton = true;`. Ordinary members and coaches cannot change this setting. Automated tests enable it only for fictional fixtures.

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
