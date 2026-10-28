# Weekly learning: draft rollout review

Nothing in this branch has been migrated to production. Current production remains f1e9812. The public interest form, its one shared-inbox notification, and existing account email setup are unchanged. Native build 13 is unchanged.

## Source model and safeguards

- Reusable plans have immutable, approved week versions; each athlete has an enrollment and their own sequence. Groups enroll separate athlete records atomically, never overwrite current plans, and retain independent histories. Explicit future overrides do not rewrite released weeks.
- Orientation (week 0) can become available immediately if ready. Week 1 starts next Sunday at **00:00 America/Chicago**. This is an explicit configurable enrollment option, not a permanent billing promise. A delayed scheduler releases one next week, then waits for the next Sunday; no backlog dump.
- The released library requires active, manually verified package eligibility; progress and grade history remain visible to the authorized household/staff when access ends. Billing/provider entitlement sync is not implemented. An eligibility record is not payment evidence. Final expiry/refund/library-access business policy needs approval.
- Only complete approved unchanged uploads release. Future readiness also checks the athlete’s age, position and experience. Missing drafts do not count as ready content. No automatic content generation or coaching-approval claim.
- CSV quiz import is validated in the browser AND server. Answer keys are private, separate from learner payloads. Objective scoring is server-side. Written questions require an authorized staff grade. Attempts pin quiz versions; grade corrections are appended revisions. A draft retry never accepts a client-supplied grade.
- Practice reporting preserves independent-recording permission and parent review. Linked athlete reports await parent approval; staff cannot impersonate a guardian. Completion means reported participation, not proof of correct technique. Submitted written quizzes stop learner reminders while staff grading is pending.
- Friday unfinished-work reminders are **in-app**, initial configurable default **17:00 Central**. They skip paused/inactive/completed work and do not backfill on another day. No Wednesday reminders. Capacity warnings are staff-only, initially below two consecutive approved ready weeks, urgent when next required week is absent. Notices deduplicate, can be marked read, and resolve/reopen based on the service condition.

## Draft 019: exact new access surface

All new tables enable RLS and deny raw anonymous/authenticated access. Security-definer RPCs validate role, profile, active-access and household/coach scope. No anonymous learning endpoint. Feature, scheduler, notices and youth flags default off.

- Owners manage eligibility, enrollment, groups, pause/resume/repeat/ending, future week overrides and Friday/threshold configuration.
- Owners/Managers can inspect in-scope client learning metadata/results and approve/withdraw week versions. Coaches read only assigned athletes; they can author their own plan/quiz drafts and grade written answers for assigned athletes. Role changes/reassignment revoke these reads/grades on the next query. This is a new learning-data permission surface, requiring explicit production review.
- Authorized household users see their own profile’s released questions, answers, grades and notices. Linked athletes still require existing access/consent checks and independent-recording permission for submissions. Youth remains disabled independently; this feature does not open child registration.
- Only `service_role` can invoke `learning_tick`; authenticated users cannot release arbitrary future weeks. No cron/job is installed by the migration.
- Customer-owned records cascade through existing profile/account erasure. Reporter/grader references can anonymize on Auth deletion. Reusable staff content follows assisted closure; existing last-owner and guardian review safeguards remain.
- Stores plan/quiz content, versions, profile-specific releases, responses, grades/feedback, completion/parent-review state, eligibility period/reason, notices/read state, groups and audit events. No child email, new payment collection, video-review quota or existing review access change.

## Draft 020: media policy, separately sensitive

Existing approved original lesson files referenced by learning snapshots are retained. New restrictive DELETE/UPDATE policies prevent staff replacement/deletion from breaking released history. A scoped SELECT policy allows signed-media access only for an authorized eligible released plan. This does not widen access to private athlete review uploads.

No new bucket, quota increase, automatic deletion or retention cleanup. Approved snapshots can retain files after a template changes; retention duration/cost/withdrawal policy must be accepted before rollout. Disabling the learning UI does not silently delete retained media. Withdrawal blocks new learning reads, while already-issued signed links may remain usable until their five-minute expiry. Existing public sample links have their existing separate public visibility; do not claim retraction erases all copies.

## Minimum staged activation gates

1. Complete source/browser/backend regression and review 019/020 together against an isolated hosted rehearsal, including Storage behavior and real Auth role claims. PGlite is local PostgreSQL rehearsal, not hosted Supabase/Storage acceptance.
2. Obtain exact approval for the above new learning-data permissions, storage retention/read policies, and account-erasure integration. Apply additive migrations with backup/restore and rollback receipt. Do not apply grouped review 013/014 as an unrelated dependency.
3. Enable source `learningPlansEnabled` and backend learning flag only for approved adult test access. Keep youth, scheduler and notices off initially. Use fictional adults and test content, no real minor data. Do not create or change staff roles to test.
4. Test manually: correct sibling, cross-household/coach denial, immutable history, protected answer keys, upload/read/withdraw, save/resume, grading, expiry/revocation, pause/resume/repeat, group atomicity, account erasure. Coaching must review actual training independently.
5. Approve scheduler activation separately after an explicit dry-run. Use the existing supported database scheduler only if available; no service or credentials have been provisioned. Schedule frequent ticks in UTC while the function computes Chicago local boundaries. Confirm Sunday/Friday DST and dedup in hosted rehearsal before a standing job. No email backfill or mass sends.
6. Client content/reminder notices stay in-app. Staff missing-content EMAIL dispatch remains off; connecting it to the existing operational outbox requires a reviewed bounded recipient/canary/no-backfill step. No routine weekly client emails, push, marketing sends or payments.
7. Publish the tested website only after review. Physical iPhone/native packaging/testing/upload is separate; shared web code does not update installed build 13 automatically.

## Rollback

Turn off frontend learning flag and backend scheduler/notices first; preserve existing manual workouts/intake/auth. Do not drop learning/history tables or delete retained objects as an automatic rollback. Revert frontend to last known production artifact. Permission-policy rollback must be explicit and tested; removing 020 would expose retained originals to existing staff deletion rules. Keep backup and migration ledger. No production rollback has been performed or needed by this source-only work.

## Known limits / follow-up acceptance

- Main service roster still uses the existing full scoped backend response, then client search/filters. Group writes are capped at 500; server cursor pagination is not yet implemented. Do not claim tested large-scale capacity.
- Google Sheets preparation is CSV export/upload, not live sync. No native Google Sheet has been created by this task.
- Placeholder walkthrough has no football demonstration media. Its clock and grading are explicitly browser-local simulations; real scoring/access logic is separately tested in PostgreSQL.
- No finished age/position curriculum, qualified coaching review, payment integration or real customer device acceptance is claimed.

## Verified hosted discovery (read-only, October 28)

The production project `iilbulpqbuknhdpmtrvm` has **no learning schema, no installed pg_cron extension, and no cron job catalog**. Management API branch listing returned an empty list. No separate authorized hosted rehearsal target is configured in this task. This was metadata-only inspection; no extension, branch, migration or job was created.

The exact additional approvals therefore need to be staged:

1. **Rehearsal target:** identify an already-owned empty nonproduction Supabase project, or approve creating an empty rehearsal target in the Repformed organization. No production user data copied, no paid plan/resource created without a separate price decision. Stage synthetic adults and staff identities only, with no outgoing mail. Apply the production baseline (001–012,015–018) then019/020; test real Auth claims and Storage policies. Library interface behavior and app routes alone do not establish hosted access safety.
2. **Production schema/security:** approve019’s private learning records/RPC grants and erasure integration plus020’s released-media read scope and retained-original DELETE/UPDATE restriction. Retention currently has no automatic expiry/cleanup and can retain originals after plans end; accept or revise that policy first. Confirm a usable provider backup/restore point before applying. Keep youth and scheduler off. No new account roles, public quiz keys, video-review quotas or billing.
3. **Adult website feature:** after rehearsal, approve the coordinated PR12→PR13 release with real authentication and `learningPlansEnabled`; enable the backend learning flag for the existing adult/private boundary. Eligibility is manual verification, not a payment event. Use a bounded existing/synthetic adult acceptance record only if separately included in the test approval; do not fabricate enrollments as real purchases.
4. **Standing automation:** because pg_cron is absent, explicitly approve enabling Supabase Cron and creating the single named job `repformed-weekly-learning`, running `select public.learning_tick(now(),false)` every minute (`* * * * *`). The function handles Sunday00:00 and configurable Friday17:00 America/Chicago; UTC cron does not hard-code a DST offset. Enable scheduler/in-app notices only after a reviewed zero-error dry-run and staged retry/DST tests. No new sending key, email/push, historical backfill or extra recipient is part of this action. Exact physical midnight execution has normal scheduler latency; actual availability is recorded separately from the scheduled timestamp.

Rollback: disable scheduler/notices and unschedule that named job, disable frontend/backend learning access, return to the known production frontend. Preserve new history tables and retained originals. Do not disable an unrelated job, drop shared extensions or remove storage retention policies as an automatic rollback. Permission-policy rollback needs an explicit reviewed script and backup plan.

## Dependency and remaining product gaps

PR13 is based on `ux/staff-workflows` at2f38796 (PR12), rather than main. Intended order after approval is PR12 first, then rebase/retarget PR13 onto that main and rerun the combined checks before PR13 merge/deploy. Neither draft is currently authorized for production publication of this second workflow pass.

The new system supports groups and scoped group grades, Friday in-app reminders, ready-content notices and shared mobile-compatible screens in source. Remaining gaps include:

- Existing service-roster summary/next-action logic still describes legacy manual workout assignments. It does not yet summarize weekly enrollment/current release/capacity, and its legacy Assign training action can coexist with the new plan pane. Resolve this before calling the whole staff workflow coherent in production.
- Global bank capacity notices currently lack an athlete-name/action drilldown; athlete-specific notices have context inside that athlete. Finish the actionable staff queue before operational reliance.
- Friday clock/ready-week threshold are global settings; package/client delivery rules from the existing monitor need a rehearsal comparison, not an assumption that they automatically configure this new system.
- Cursor pagination/load testing, standing scheduler, hosted Storage/Auth rehearsal, staff missing-content email wiring, billing entitlements, final retention/expiry/refund policy, actual curriculum and native-device acceptance remain unfinished.
- Home/Contact future-plan wording is aligned without claiming availability; the historical partner guide/screenshots and all legacy help/manual controls are not yet rewritten into a complete weekly-plan handbook. Public interest/auth remain intact. No native TestFlight update is implied.

These are explicit remaining requirements, not claims that passing source tests makes a paying youth launch ready.

Backup metadata inspection returned zero listed backups, PITR disabled and WAL archiving enabled. This does **not** establish an available restore point or exclude a separately held manual backup. Verify a usable restore procedure before production schema changes; do not assume WAL-enabled means the project can currently restore to any chosen time.
