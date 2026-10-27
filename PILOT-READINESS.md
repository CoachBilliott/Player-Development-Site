# Repformed core journey audit

## Latest unpublished implementation checkpoint

The grouped-review workflow is implemented behind a disabled backend setting
(migration 014), with 269 unit and 32 affected browser cases passed locally.
The client-service dashboard is implemented behind `staffRosterEnabled: false`
(migration 015): Owners/Managers see all clients in this deployment, Coaches
only assigned athletes. Six new database-policy tests, four desktop/phone browser
cases, lint, types and build passed. These are distinct runs, not a newly rerun
combined suite. [Actual screenshots and exact rollout boundary](docs/staff-service-preview/README.md)
are ready for review. Neither migration nor feature was published. The older
preflight-only validation below records the preceding checkpoint.

Custom delivery alerts, customer in-app/email notifications and simulated
purchase/delivery acceptance views remain queued. No SMTP, scheduler, payments,
junior access, real role grants or new TestFlight binary were enabled.

Today's defensible acceptance target is an **invite-only adult customer journey**,
with fictional athlete nicknames and original adult/noncontact test clips. This
is not approval to open real junior enrollment or charge families.

## Verified facts

- The live Auth service keeps public signup disabled. Its eight-character
  password minimum and upper/lower/number/special-character rules match the app.
- The live database keeps both under-18 enrollment and child self-access false.
  No gate, role, invitation, email, payment or production profile was changed by
  this audit.
- The partner's supplied **app** email has no Auth account. Their Apple identity
  and membership of TestFlight's Owner Testing group do not create an app role.
  The private address is intentionally not copied into this public repository.
- Custom SMTP host and sender are not configured. Default-provider limits mean
  invitations/recovery need actual delivery acceptance; the Contact Gmail link
  does not provide automated sending.
- The website is deployed and independently browser-verified. Native 0.1.0 (13)
  is VALID and IN_BETA_TESTING in Owner Testing. Those facts do not establish
  physical-phone camera, recovery or upload acceptance.

## Existing support versus remaining work

| Area | Implemented evidence | Remaining gap or acceptance |
| --- | --- | --- |
| Adult access | Verified invitation acceptance, password setup/recovery, private profile CRUD, staff/customer separation; browser/server tests | Dedicated sending configuration and actual inbox/device acceptance |
| Partner Owner access | Existing Owner can promote a verified adult after setup; confirmation, version/audit and last/self-Owner protections are tested | Partner account absent; invitation/activation and a specifically approved Owner grant are still required |
| Family permissions | Per-profile controls, one linked-athlete identity, parent review, revocation and known-minor protection; SQL/browser tests | Legal/business guardian verification, consent/withdrawal, age transition and support process; real juniors stay closed |
| Training | Shared content drafts/approvals, ordered workout builder, eligibility and Owner assignment | This branch adds independent athlete plans; migration 012 and updated web/native code need review and an approved release. No production migration applied |
| Practice/progress | Guided steps, completion acknowledgement, save/resume, idempotent reporting and parent/self-reported history | Actual phone acceptance; completion/parent approval is not an ability assessment |
| Video reviews | Preview, private upload, assigned-coach feedback, deletion and 48-hour fulfillment tracking; browser/SQL/native bridge tests | Actual camera/Photos/audio, transfer interruption, playback/deletion and feedback return on both phones |
| Content pathway | Existing matching/upload/review workflow | The first two-session adult draft is supplied in this branch; qualified coaching review, final repetitions/rest and licensed/original demonstration media are still required |
| Weekly release | Owner-only Sunday/time-zone preview and device-local draft; rejects skipped/repeated clock times | No live scheduler or server release gate is enabled; canonical timezone/time and activation need owner approval |
| Packages | Recorded: $15 single review, $45 monthly, four reviews per child, up to three minutes total per review | Clarify per-child versus household charge, billing cycle/unused credits, cancellation/refund and failed-payment terms; the recorded inclusion is already decided |
| Billing | No checkout, charge, paid credit balance or automatic entitlement has been enabled | Payment-provider account/secure credentials, verified webhooks, renewals, failed charges, cancellation/refund tests and iOS purchasing-policy review |

Age bands and adult/guardian acknowledgements are not verified birth dates or
legal certification. The app must not claim a trusted guardian process merely
because a checkbox or synthetic test passes.

## Safe changes in this review branch

1. Fix the member-library dead end: direct customers to their eligible assigned
   training instead of claiming all training must wait for billing. Charges and
   paid access remain inactive; no content permission is granted by this link.
2. Expand the private readiness view with email, actual-phone, family-assignment
   and scheduling limitations, plus the Owner-selected draft prices.
3. Add a continuous synthetic adult-household acceptance case using distinct
   parent/coach identities: two assigned drills, one completion, private upload,
   coaching feedback and progress persistence. Invitation/profile setup and
   junior/age boundaries retain their separate existing tests.
4. Supply `content/pathways/adult-football-foundations.draft.json`: two adult-only
   session drafts, required review fields/media rights, no automatic publication
   or assignment. This is a coaching-review handoff, not an approved curriculum.
5. Add `releaseSchedule.ts` as a pure preview utility. Tests cover Sunday UTC
   conversion, the autumn offset change, nonexistent spring times, repeated
   autumn times, invalid inputs and the exact release boundary. It is not a
   server authorization gate and no content release job is created.

6. Add migration draft `backend/012-per-athlete-workout-assignments.sql` and an
   athlete picker for Owner assignment. Each sibling has an independent snapshot,
   revision and removal tombstone. Eligibility, ordered completion and practice
   resume resolve the same athlete snapshot. Legacy account defaults and loose
   grants are preserved. The migration has run only in local synthetic databases.
7. Add an Owner-only Sunday preview form. Time and timezone start unset. A draft
   is scoped to the signed-in Owner on this device; it is not a shared business
   setting or a live scheduler.
8. Preserve the selected athlete across tab refresh using only a user-scoped
   session selection ID. Profiles are fetched and authorized afresh; unknown IDs
   are ignored, and selection IDs are cleared on sign-out/account changes. No
   private profile records are cached by this change.
9. Add read-only grouped-review preflight draft 013: up to three proposed
   60-second clips, 180 seconds combined, same athlete/drill, existing access and
   finite storage safeguards. It creates no groups, reservations or credits and
   explicitly reports grouped submission unavailable. The durable grouped
   workflow remains future implementation; see [the design and quota tradeoffs](REVIEW-GROUPING-DRAFT.md).
   Current customer copy separates the five stored-clip spaces from review
   allowance and states the existing one-clip limit and feedback-deletion effect.

## Smallest owner action list

1. Select/configure the dedicated email sender securely, then approve a real
   invitation/recovery delivery test. Do not send passwords or keys in chat.
2. Use the partner's already-supplied app email in the existing staff invitation
   and setup flow. After verified adult activation, approve the separate Owner
   promotion from the existing Owner workspace. The Apple identity is separate;
   an Owner does not need a customer account just to reach the staff tools.
3. Approve a separate adult customer test identity for the family journey. Use
   fictional 18+ profiles; keep both real junior gates closed.
4. Have a qualified coach review the two-session draft, approve its adult scope,
   final instructions/timing and demonstration rights. Other age/position
   pathways remain future work until reviewed.
5. Keep the recorded $15 single-review / $45 monthly / four reviews per child /
   three-minute-total review terms. Clarify whether the monthly charge is per
   child or household, credit cycle/expiry and refund/cancellation rules. Choose
   the provider and iOS/web purchase route before secure test credentials. Test
   renewals, credits and failed-payment/cancellation access before charges.
6. Choose the canonical Sunday timezone and local time. The preview does not
   activate scheduling or replace approval/assignment checks.
7. Complete the two-phone acceptance below. Review this branch's scope before
   publishing UI changes or any future onboarding/payment activation.

## Actual service/device acceptance, still unperformed

- Existing Owner/partner devices: install/update build 13, sign in/out and verify
  the correct staff role without Parent/Athlete setup. Verify the new customer
  identity sees only its own household; direct URLs must not grant staff access.
- Receive invitation/reset email, accept it in the intended browser/app flow,
  and test an expired recovery link. A successful send API response is not proof
  of delivery. No acceptance emails were sent by this audit.
- Owner: approve original adult training, build the ordered workout, preview
  eligibility and assign it. Customer: select the adult profile, practice, save,
  reopen/resume, finish twice and confirm exactly one report after refresh.
- Record/select an original short adult clip, cancel once, preview/send, then
  let the assigned coach return feedback. Reopen both accounts and confirm
  status, feedback and history. Verify interrupted uploads fail honestly and
  private video deletion is confirmed.
- Verify another account cannot mint a fresh private-media URL or read the
  profile/review record. Already issued review URLs are short-lived bearer links
  (60 seconds); protected training URLs last five minutes. A copied valid URL
  can work until expiry. Immediate bearer-link revocation is not implemented or
  claimed; decide if a stronger delivery design is required before child use.
- Test selected-profile persistence, large text, VoiceOver, camera/library/audio,
  orientation and background/connection interruptions on the actual phones.
  Browser emulation, simulator success and a legal checkbox do not replace this.

## Accepted package terms versus current upload limits

The three-minute-total allowance is a recorded business requirement, not an
implemented paid entitlement. Customer `inspectVideo` validation and the
`begin_athlete_video` database function currently cap one clip at 60 seconds.
The 180-second staff content-upload limit is a different workflow. The pilot
also allows five stored clips per account and a shared storage budget; those
are not monthly credits. Align the submission format, native preparation,
storage/retention and server entitlements before selling the package. This
branch does not raise those limits or enable charging. The submission flow must
enforce the recorded three-minute total whether it accepts one clip or a combined
submission; the duration allowance does not need reapproval.

## Validation of this review branch — 2026-10-27

- Lint, TypeScript and production build passed.
- All **260 unit tests** passed, including nine new per-athlete database-policy
  cases, seven grouped-review preflight cases against migrations 001–013 and
  four Sunday/time-zone boundary cases.
- The full phone/desktop browser suite passed **240 cases** with no failures
  before the subsequent read-only preflight and review-copy changes.
  It includes separate sibling assignments, cancelled confirmation, repeated taps,
  independent completion/history, selected-athlete refresh persistence, owner-only
  Sunday configuration, clock changes, device-only save and discard behavior.
- All **eight installed-web-app/offline cases** passed, including private-record
  exclusion, update handling and offline reopen.
- After the final staff-copy correction describing the minimal Owner athlete
  lookup, all six targeted staff-role browser cases passed again, along with
  lint and production build. This rerun is a subset of the full suite.
- After the grouping preflight/review-copy changes, all **28 affected review-flow
  browser cases** passed, including current one-file controls, storage wording,
  cancellation, upload/retry, coaching feedback and the adult-household journey.
  Lint, types, the full 260-test unit suite and production build also passed.
- SQL cases cover wrong-household/profile substitution, raw-write/internal-helper
  denial, linked-athlete isolation, parent pause/revocation, stale/idempotent
  assignment, legacy defaults/removal tombstones, isolated resume invalidation,
  review-note redaction, content withdrawal and erasure freezes/cascades.

These are synthetic local tests. Hosted CI, a new native build, hosted migration
rehearsal and actual inbox/phone/service acceptance have not run for this pilot
branch. Production's separate brand-kit release passed its full hosted checks;
that result does not approve these unpublished pilot changes.

## Publication boundary

This branch is for review. It performs no production account grants, database
migrations, payment/SMTP credential creation, legal acceptance, live charging,
junior enrollment, new AI service, website deployment or TestFlight upload.
Existing production and build 13 remain unchanged. Material onboarding/payment
flows require explicit scope review before live activation.
