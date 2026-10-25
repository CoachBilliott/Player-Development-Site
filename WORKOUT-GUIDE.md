# Build and assign a complete workout

Open **Content → Build a complete workout**, or **Overview → Build workouts**. This private staff tool uses existing protected uploaded drills. It does not create public demos, change account levels, enable juniors or collect payment.

## Compose, preview and save

1. Choose **New workout**. Enter a name and optional introduction.
2. Search protected drills and tap **Add**. Use the up/down controls to set the exact practice order, or remove a drill from this template. Removing a drill here does not delete the uploaded resource.
3. Check the shared audience and duration. The pilot supports 1–12 unique protected published drills and at most 60 planned minutes, with whole-minute drill durations. Those are technical limits, not approved exercise prescriptions. All drills must have at least one common age, position and experience audience; goals do not reorder a saved workout.
4. Choose **Preview workout**. Inspect its full order and each drill's attached media, purpose, equipment, practice steps and cue. The matching examples are fictional, not private player profiles. Going back does not save or record practice.
5. Choose **Save workout**. It becomes a shared private staff template. Owners/Managers manage templates across staff; Coaches manage their own. Unsaved template edits are screen-only; save before leaving. This is separate from the upload editor's explicit device-draft feature.

Refresh saved workouts to recover the latest server versions. Repeated saves use stable IDs; conflicting stale writes are rejected. A failed response preserves the open draft. If another staff member changed the template, refresh and reopen the correct saved version rather than overwriting it blindly.

## Owner assignment

1. Open a saved workout. If you changed its fields, save or discard those edits first.
2. Under **Assign this workout**, choose a verified customer account. Owners already have access to this account directory; this tool does not grant it to Coaches or Managers.
3. Choose **Preview assignment**. The server checks whether at least one eligible athlete on that account matches every drill. Staff do not receive player names, ages or private profile records from this check.
4. Review the account email, workout/version and number of ordered drills. **Keep current assignment** cancels. **Confirm workout assignment** stores the ordered session without charging anything or modifying review-coach/video permissions.
5. The athlete refreshes Today/Workouts. Matching athletes see the named workout, introduction and every drill in its saved order, including workouts longer than the loose-plan limit of three drills. Its title/version is retained with reported participation.

This first builder supports **one current saved workout per customer account**, not a calendar or multiweek program scheduler. A nonmatching family athlete keeps any separately granted matching loose drills; the program is not silently shortened to fit them. Existing loose-drill access is managed separately in Account access. Future per-athlete calendars and multiple scheduled sessions require additional work.

## Revisions, removal and reporting

- Editing a template does not silently update an already assigned session. Assign the new saved version explicitly. The assigned copy preserves its name, introduction, drill IDs and order; attached drills still use their current instructional content.
- If a drill becomes private-ineligible, unpublished or deleted, the saved session becomes unavailable as a whole. It is not reported as a completed shortened workout. Fix/reassign the template. Separate loose permissions remain separate.
- An athlete session is tied to the template/version opened. If that assignment changes during practice, the server rejects a mismatched completion instead of attaching it to a different program. A repeated request for an already-recorded report reconciles to the same history entry.
- Remove a current assignment with explicit confirmation. Existing practice history, uploaded drills, separate loose permissions and video-review settings remain unchanged.
- Removing a saved template requires confirmation and clears its current assignments. Snapshot titles remain in existing practice history. Assignment revisions stay monotonic even after removal, so stale edits cannot overwrite a newly assigned workout.
- Playback, template previews, returning to an earlier drill and unfinished/canceled sessions do not create practice reports. Reports record participation, not athletic improvement.

## Verification and launch boundaries

Migration `008-workout-builder.sql` was applied once to the dedicated project. Do not rerun it. Policy tests cover role and household isolation, private helper restrictions, matching, ordered completion, snapshot revisions, retry idempotency, withdrawn drills, historical names, removal/version conflicts and retained minor markers. Live database checks use fictional adult identities entirely inside rolled-back transactions. Browser fixtures are fictional and do not write to real customer accounts.

Qualified coaching review and actual iPhone acceptance remain required. Public enrollment, live subscriptions, real junior accounts/media and public App Store release remain closed. This workflow does not guarantee training, recruiting or scholarship outcomes.

## Approved content and saved practice

New shared drills follow Draft → Awaiting review → Approved. Owners/Managers approve; Coaches submit their own drafts. Only approved published protected drills can be composed or assigned. An edit returns a drill to draft and withdraws affected assignments until reapproval and explicit reassignment. Staff release approval is separate from qualified coaching review.

Customers can choose Save & leave workout and Resume workout after reopening or refreshing. Select the same athlete in a family. The next drill position is stored privately on the server under the signed-in user and athlete, never in the public demo cache. Resume checks current access, permission versions, assignment revisions and drill versions. Changed/withdrawn content or stale device writes require refreshing training. Saved places expire after seven days; expired/invalid entries are removed when checked. Pausing never creates completion history. Finish uses the stable session ID and clears the resume atomically; repeated finish requests do not intentionally create duplicate reports. Discard removes only unfinished practice after confirmation.
