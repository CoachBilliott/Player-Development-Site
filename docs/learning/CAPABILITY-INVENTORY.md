# Verified capability inventory and staged delivery scope

> Historical inventory, retained for source provenance. Current production and TestFlight15 are0816c343; PR12 is already merged/published. PR13 weekly learning remains draft. Use VALIDATION.md and ROLLOUT-REVIEW.md for current release/acceptance gates; the earlier baseline below is not a current deployment instruction.

Baseline: production `f1e9812` / PR11. PR12 is unpublished. This inventory was
verified against the content schemas, staff roster RPC, assignment RPCs, uploader
and all existing SQL migrations. Package descriptions are proposals, not evidence
of a built capability.

| Area             | Existing persistent capability                                                       | Missing at this baseline                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Content          | Protected video/image/PDF/text attachments, instructions, audience and review stages | Dedicated quiz-upload, submission and grade tracking; format subsequently selected: Google Sheets CSV |
| Quizzes          | Proposed package copy only                                                           | Quiz-file versions, submissions, authorized grading, attempts and gradebook                           |
| Athlete training | Owner-assigned saved workout, per-athlete overrides, siblings kept separate          | Multiweek enrollment and automatic progression                                                        |
| Progress         | Practice/resume/completion records, parent approval, private review history          | Week checklists, quiz grades and complete released-week library                                       |
| Groups           | Multiple clips in a review request; not a cohort                                     | Cohort membership, group enrollment and group weekly publishing                                       |
| Delivery         | Manual monitoring/rules and private notices                                          | Verified live Sunday publisher and Friday reminder scheduler                                          |
| Scale            | Scoped roster, client-side search and service-status filters                         | Server pagination; current RPC aggregates the full roster with per-athlete detail                     |
| Billing          | Proposed packages and manual training permissions                                    | Verified paid package entitlement/renewal integration                                                 |

Generic PDF/text upload is not quiz import and cannot collect or grade answers.
The drill schema has lesson/steps/cue fields, no question/answer/score fields.
The roster RPC has no cursor, offset or page argument. Delivery-package settings
are monitoring defaults, not paid enrollment or automatic content distribution.

## Latest authorized target

- Reusable, versioned learning plans and pre-approved weekly lesson/drill/quiz
  content. Enroll each athlete once, including individual siblings and group
  enrollment. Never treat a household as one athlete.
- Weekly release at **Sunday 00:00 America/Chicago**, converted using the time zone
  database. No fixed UTC clock. Released weeks stay in the eligible athlete's
  library; historical progress, assigned versions and quiz scores are preserved.
- **Friday** incomplete-week in-app reminders to authorized athlete/guardian
  recipients. Proposed configurable default: 17:00 America/Chicago. No routine
  weekly client emails.
- Staff-only capacity warnings based on consecutive approved, publishable ready
  weeks, not draft counts. Proposed configurable threshold: fewer than two ready
  weeks; urgent when next Sunday has none. Deduplicate, resolve and respect pauses.
- Staff preview, pause/resume, repeat and individual future-week overrides.
  Orientation immediately and first Week1 on the next Sunday are configurable
  proposed enrollment defaults, not irreversible policy.
- Preserve current role scope: Owners/Managers can see client service; Coaches
  only assigned athletes. New enrollment/publishing authority is proposed
  Owner-only to preserve existing training-assignment permissions until reviewed.
- Quiz grades are stored by authorized server operations; learners cannot supply trusted scores. Quiz uploads reference stable versions. No quiz-building/question-authoring tool is requested. Athletes must take quizzes in Repformed on web/app. A documented structured import template and validation/review may be prepared, with protected server scoring for multiple-choice/true-false and coach review for written responses. Google Sheets CSV is the selected format; arbitrary PDF/Word documents are not supported quiz imports.

## Coherent implementation stages

1. Finish athlete-context assignment UI using existing profile RPCs. Do not
   require selecting the same customer/athlete again. Keep individual account
   permissions separate. Add filters using existing authorized roster metadata.
2. Prepare additive learning-plan/enrollment/release, submission/grade history using the selected CSV contract, cohort and
   notice schema with explicit RLS and server operations. Rehearse with synthetic
   adults only. No production schema application in this stage.
3. Build shared staff upload/plan management and athlete/guardian current-week/library/grade
   views. Add a clearly fictional interactive demo. Preserve legacy workouts and
   make missing deployment/setup honest rather than fake success.
4. Test calendar/DST, idempotency, partial failures, late runs/no backfill,
   pause/restart, plan/package changes, sibling/guardian isolation, assigned Coach
   scope, scoring and version/history preservation. Prepare a disabled scheduler
   and dry-run receipt.
5. Present exact production migration, storage/retention, access and scheduler
   activation scope for approval. Existing interest intake/email/homepage must
   stay intact. No new credentials, recipients, paid services, child enrollment
   or native release without the required separate authorization.

## Gates and unresolved launch policy

Current package IDs can label proposed eligibility; they are not proof of payment.
Manual access must remain explicit until billing/webhooks are connected. Active
membership library access on downgrade/end needs an explicit configurable policy;
retain grade/history records without promising unrestricted old media access.
Content snapshot retention/private media permissions require review before live
activation. New junior enrollment stays closed pending actual guardian safeguards
and consent acceptance. No claim of qualified coaching review is made by code.

## Source increment, October 28 (not production)

The weekly-learning branch adds draft migrations 019/020/021, server-side import/scoring/attempt history, athlete-specific enrollment, immutable week releases, group enrollment, configurable Friday in-app reminders, staff-only content capacity notices, and a fictional interactive walkthrough. This does not change the production inventory above. The importer contract is in [QUIZ-GOOGLE-SHEETS.md](QUIZ-GOOGLE-SHEETS.md). No quiz-writing studio or Google account connection is needed. Production migration/security/storage/scheduler approval and hosted/device acceptance remain required.

Follow-up source now includes weekly roster summaries and next actions, server keyset paging, actionable athlete notices, saved group edits/new-only enrollment, quiz re-import version selection, distinct Today/Library/Progress views and a weekly help guide. These replace the earlier source-only UI gaps; hosted activation and production inventory remain unchanged.
