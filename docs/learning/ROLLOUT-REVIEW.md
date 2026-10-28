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
