# Scoped roster and fictional learning follow-ups

Current production and TestFlight15 remain **0816c343a99a76e03ad2e48c7e16207058624c02**. These drafts are not production learning activation or a new native build. No migrations, accounts, grants, credentials, emails or live customer records changed.

## Server-scoped roster loading

[Draft PR #21](https://github.com/repformed/Player-Development-Site/pull/21), source **d791232c91cbdfdcc00cb6a6d3d70d3ee98d0e53**. Migration023 and client true flag remain unapplied/off. Local395 unit/database and40affected desktop/phone checks passed. The first aggregate failed only two mock-based preview journeys because the fixture lacked Supabase's abortSignal builder; that fixture was corrected, all6 private preview checks reran successfully, and final fullCI 40953863302 is GREEN (395 unit/database,448 web,10 app/offline,6 private preview,11 Python plus lint/types/Deno/build). No authorization assertions were weakened.

Read [exact approval/rehearsal/recovery proposal](APPROVAL-BUNDLE.md). Hosted Auth/RLS/Storage and actual-role acceptance are not established by these local tests. No approval to apply023 is recorded here.

## Fictional sample journey

[Draft PR #22](https://github.com/repformed/Player-Development-Site/pull/22), source **30601cd8cc89f38e5220be17506d22a793f0d765**.

- [Interactive isolated preview](https://sample-learning.repformed.pages.dev/#sample-week)
- [Immutable preview](https://dd429a9b.repformed.pages.dev/#sample-week)
- [Actual Cloudflare preview deployment receipt](sample-learning-preview-deployment.json)
- [Exact built artifact walkthrough,320/390/1440px](artifact-smoke.json)
- [Local390px lesson screenshot](screenshots/artifact-390-lesson.png), [quiz](screenshots/artifact-390-quiz.png), [progress](screenshots/artifact-390-progress.png), [desktop progress](screenshots/artifact-1440-progress.png).

The sample text is draft/pending review. No reviewed lesson/drill video is supplied. The quiz is a public local illustration, not trusted grading. Progress is temporary browser memory; no account or coaching assessment exists. Practice shows structure only and is not assigned/completed. Backend/Auth/intake disabled; visible preview disclosure, noindex and restrictive CSP. Never promote this disabled-backend artifact as production.

Local lint/build 378 unit/database and46affected browser checks passed; exact artifact walked separately at 3-widths with zero writes. Overlapping counts are not summed. Final fullCI 40954155710 FAILED:436 web pass,2 screenshot-path writes EACCES, subsequent app/private-preview stages skipped. Fix/revalidation remains required. Independent public-browser and physical-iPhone verification are not recorded here.

Repository footage is documented marketing stock, not instructional media. Ordinary public catalog returned401; stopped with no alternate credential. Private catalog was not inspected. Actual approved/licensed representative media and draft-text review remain a content gate; this shell does not solve missing coaching content.

## Remaining product gates

PR #13 weekly learning/quiz grading/library/reminders remain unmerged/off pending actual hosted acceptance, recovery and precise production permission/scheduler approval. Normal browser harness access was last reported blocked by ERR_QUIC; no security/network bypass attempted. Physical iPhone/all live-role performance and privacy remain unverified. See [finding-by-finding statuses](FINDINGS-STATUS.json); no overall A grade is claimed from fixture passes.

## Consolidated every-feature/role audit

[Full audit,29October2026](FULL-AUDIT-2026-10-29.md): production/build 15 identity, all-role/feature matrix, performance/design/complexity, passed/failed/blocked/notreleased, P1gates/P2findings and exact next actions. No blanket score for inaccessible roles.
