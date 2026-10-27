# Action-first service workspace

An update to the existing fictional interactive preview, not another application.
Production accounts, database permissions, notification activation and TestFlight
are unchanged. The notification implementation remains preserved in `5d41200`.

| Screen | Desktop | Phone |
| --- | --- | --- |
| Searchable service roster | [Open](overview-desktop.png) | [Open](overview-phone.png) |
| Focused athlete details | [Open](detail-desktop.png) | [Open](detail-phone.png) |
| Next step immediately after sample coach save | [Open](after-coach-save-desktop.png) | [Open](after-coach-save-phone.png) |

The roster now uses four columns: athlete, training, service coach and next action.
Overdue records sort first. Status summaries act as filters; search matches athlete,
client, coach, position and assigned workout using case-insensitive word matching.
The filter menu includes overdue, attention, ready and unassigned records. Counts,
no-results and clear/reset states reflect the current scoped records.

Each athlete has a specific action: review an overdue task, assign a service coach,
review training needs or open details. Assignment controls are Owner-only, with
explicit browser-only sample feedback in the preview. Managers see all sample
clients read-only; Coaches see assigned athletes. No upload, payment, real coaching
feedback or real training assignment action is fabricated.

Details prioritize the next step; an unassigned athlete opens directly to the
coach selector. Training, practice/release and account/payment context use
progressive disclosure. Browser Back, on-screen Back and Escape preserve search,
filter and roster context, and return keyboard focus to the originating action.

Validation for this refinement: 4 isolated desktop/phone preview cases; 8 affected
staff-dashboard/notification browser cases; 17 existing staff/delivery database
policy cases; lint, types and both production/isolated-preview builds. Search,
status filters, empty/reset, role scope, keyboard interaction, focus restoration,
back navigation, 320px overflow, accessibility and zero external preview API
requests are exercised. These overlap prior tests; no new native-device or hosted
database acceptance is claimed. The earlier notification slice's broad validation
is recorded separately in `docs/delivery-preview/README.md`.

Publishing is limited to the existing `client-service-preview` Pages branch. The
public alias remains https://client-service-preview.repformed.pages.dev/. Verify
the returned deployment environment/source and unchanged canonical production
deployment. This worker's public Cloudflare requests were restricted previously;
independent public-browser verification remains a separate acceptance step.

Follow-up regression: the sample adapter now derives the next step on every read,
matching the backend projection instead of retaining old fixture text. Saving a
coach for Morgan changes the **open** detail's next step to `Assign training`;
removing the coach restores `Assign service coach`. All **6 preview cases** passed
on desktop/phone, including both transitions and the existing search/back/reset
checks. Lint, types and the isolated-preview build passed. This correction changes
only the fictional adapter and tests; no production API or migration changed.

The separate notification validation and migration record remains available at
[`docs/delivery-preview/README.md`](../../delivery-preview/README.md) and
[`backend/PILOT-MIGRATION-REVIEW.md`](../../../backend/PILOT-MIGRATION-REVIEW.md).
