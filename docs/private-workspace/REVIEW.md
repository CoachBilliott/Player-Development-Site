# Signed-in workspace review

This is a UI-only change on `ux/private-workspace`. The public homepage, packages,
interest intake, email configuration, backend functions and database policies are
unchanged. The current installed TestFlight build is not updated by this branch.

## What changes

- One account sign-in form, with password visibility, recovery and verification
  modes. Modes have Back/Forward history, clear feedback and heading focus.
  Successful fresh sign-in opens the role's workspace; opening Account while
  already signed in opens personal settings.
- Personal Account contains identity, password, sign-out, privacy help and the
  existing guarded account-closure flow. It does not fetch the staff directory
  or duplicate invitations and entitlement administration.
- Owners manage Accounts & roles, Invite staff and Training access in separate
  Team & access sections. Existing self/last-owner protection, verification,
  adult setup, confirmation and server authorization remain required.
- Review requests link to the Training access section and preserve the exact
  requesting account without a search. This does not grant access automatically.
- Staff navigation connects Client service, Content, Workouts and Reviews.
  Owners/Managers can also open Interest independently of the service-roster
  rollout flag; Team & access remains Owner-only. Manager coach assignment stays
  in Client service, not role administration.
- Customers have Today, Workouts, Progress, Family profiles/Profile and Account.
  Profiles and guardian controls are separate from credentials and training.
  Returning from a profile's training restores focus to its profile action.
- Directory, private interest and coach review queues distinguish loading from
  empty results and show retryable errors. Role/actor changes clear scoped data.
- Phone and desktop use the same private navigation and restrained brand styling;
  the public site's chrome and conversion journey are preserved.

## Preview boundary

https://private-workspace-ux.repformed.pages.dev/ is a fictional design preview.
Its role selector is not authentication. It constructs no real Supabase client,
contains no production connection configuration and has a `connect-src 'none'`
CSP. Form/account/role mutations fail explicitly; they cannot affect real people.
Training/content routes not implemented in the preview are labeled accordingly.
Use the real-app fixture tests for those integrations, not the role selector as
proof of backend authorization. The preview is noindex and has no real account
or customer information.

## Release boundary

PR #11 remains draft for review. No production publication is approved for this
UX change. Release, if approved after checks, requires the normal authenticated
production build, not the isolated fake-client preview artifact. No production
migration, role grant, Auth change, sender, scheduler or native upload is needed
or included. Actual owner/partner device acceptance remains separate from
Chromium fixture and offline tests.
