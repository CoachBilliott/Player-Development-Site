# Repformed core journey audit

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
| Training | Shared content drafts/approvals, ordered workout builder, eligibility and Owner assignment | One current workout per account; different concurrent sibling plans need a separately reviewed per-profile design |
| Practice/progress | Guided steps, completion acknowledgement, save/resume, idempotent reporting and parent/self-reported history | Actual phone acceptance; completion/parent approval is not an ability assessment |
| Video reviews | Preview, private upload, assigned-coach feedback, deletion and 48-hour fulfillment tracking; browser/SQL/native bridge tests | Actual camera/Photos/audio, transfer interruption, playback/deletion and feedback return on both phones |
| Content pathway | Existing matching/upload/review workflow | The first two-session adult draft is supplied in this branch; qualified coaching review, final repetitions/rest and licensed/original demonstration media are still required |
| Weekly release | A tested preview resolves explicit Sunday/time-zone choices, rejecting skipped/repeated clock times | No scheduler exists or is enabled; business timezone/time and server-enforced release/access design need approval |
| Packages | Selected prices are $15 single review and $45 monthly | Monthly inclusions, athlete limits, review allowance, cancellation/refund and failed-payment terms are undecided |
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

## Smallest owner action list

1. Select/configure the dedicated email sender securely, then approve a real
   invitation/recovery delivery test. Do not send passwords or keys in chat.
2. Confirm the partner's app email separately from their Apple identity. Use the
   existing staff invitation/setup path, then separately confirm an Owner grant
   after verified adult activation. Do not turn an Owner into a customer just to
   test workouts.
3. Approve a separate adult customer test identity for the family journey. Use
   fictional 18+ profiles; keep both real junior gates closed.
4. Have a qualified coach review the two-session draft, approve its adult scope,
   final instructions/timing and demonstration rights. Other age/position
   pathways remain future work until reviewed.
5. Decide what $45 monthly includes and the $15 review's refund/cancellation
   rules. Choose the provider and iOS/web purchase route before configuring
   secure test credentials. Test money/entitlements before enabling charges.
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

## Publication boundary

This branch is for review. It performs no production account grants, database
migrations, payment/SMTP credential creation, legal acceptance, live charging,
junior enrollment, new AI service, website deployment or TestFlight upload.
Existing production and build 13 remain unchanged. Material onboarding/payment
flows require explicit scope review before live activation.
