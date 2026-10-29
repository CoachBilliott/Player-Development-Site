# Staff workflow review

This second usability pass is based on production `f1e9812` (PR #11). It is a
website/app-compatible source change for review, not an approved production or
native release. The homepage, packages, public intake, Auth configuration,
backend functions, database permissions and notification activation are unchanged.

## Three daily jobs

- **Athletes**: find the athlete, see what needs attention, manage the service
  coach within existing Owner/Manager permissions, then open the relevant review
  queue or assign a workout inside the athlete record. Customer and athlete stay
  fixed; they are not selected again. Browser Back returns to the athlete record. Staff alert diagnostics and
  delivery rules are no longer expanded beneath the daily roster.
- **Training**: one searchable bank of saved workouts and lessons. Preview a
  lesson, edit it or hand it to the existing workout builder. Assign its saved
  drill order from the athlete record after inspecting the current workout,
  previewing eligibility and confirming replacement. Legacy assignment URLs
  retain their guarded flow. Cancel never grants access. Existing siblings and practice
  history remain independent. Builder edits still require save/preview; an
  assignment never silently picks up template edits.
- **Staff & settings**: Owners manage people and invitations separately. Account
  controls expand for one person; role changes retain confirmation, self/last
  Owner protection and server rules. Managers and Coaches see limited settings
  and help, without an account directory or Owner-only mutation controls.
  Delivery checks use existing scoped reads and Owner-only rule editing.

Personal credentials stay in Account. The same three jobs are used in the app
navigation. Existing protected routes still work, including legacy review-request
links to individual training permissions. The installed iPhone app is unchanged.

## Manual permissions are not packages

Individual resource grants and the account-wide review toggle/assigned review
coach are retained under Training → Assignment and publishing details → Individual
lesson & review permissions. Loose lesson grants are optional and collapsed;
a whole workout assignment does not require duplicating those checkboxes.

A workout can include up to 12 approved matching drills. Assignment is currently
Owner-only, one current saved workout per athlete. This pass does not broaden
Manager/Coach assignment rights, create multiple active plans, implement paid
entitlements or publish weekly content to a package group. Package scheduling and
background notification delivery remain separate unfinished infrastructure.

## Review preview

The isolated preview uses fictional adult records and in-memory read fixtures.
No real Supabase client is constructed; CSP blocks network connections. The
preview includes the actual bank, builder, assignment confirmation and staff
controls. Writes fail explicitly. Preview confirmation does not assign a real or
fictional workout or change a role. Missing media is labeled, never represented
as a coaching demonstration.

Screenshots are generated under `artifacts/staff-workflows`. Checks include the
new journeys, role boundaries, cancellation/repeated clicks, replacement and
snapshot behavior, URL/history/focus, errors, keyboard accessibility and phone
widths. Final counts and CI status belong in the pull request/release receipt.

The independent October 29 phone review found that the sticky return action could
cover the inline assignment cancellation button after scrolling. Staff dialogs
now reserve scroll space for that action. Real-component and isolated-preview
regression assertions check the cancellation button's hit target, rather than
only checking that it exists in the DOM. No permission or assignment behavior
changes accompany this layout fix.
