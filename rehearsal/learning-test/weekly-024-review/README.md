# Draft024: source review handoff

Source **1e2269fe72df886685c860308d9c17880d7288a2**, PR13. Prepared October29,2026. This is a source-review bundle, not an executed migration or deployment. The Owner's test023approval does **not** authorize024. Existing website0816c343/TestFlight15 remain unchanged.

024adds package/household/athlete weekly reminder preferences and a notification-package choice independent of access/billing. It preserves Sunday00:00America/Chicago, scopes to existing roles, and gives only Owners the two new configuration RPCs. Existing package/household/athlete table RLS and private media access are unchanged. Client in-app ready notices and assigned-staff capacity routing honor existing preferences. No routine client email, push, accounts, credentials, flags or Cron are enabled.

Install requires reviewed016and019–022 and all learning/scheduler/notices/youth flags OFF. Rollback also requires all flagsOFF, restores former functions and keeps preferences, releases, attempts and grades. Do not resume global-only legacy reminders over stored opt-outs without compatibility review. See ACCESS-AND-ROLLBACK.md for exact grants, compatibility and safety bounds.

## Validation

Final-head CI40968374045 was running when this bundle was prepared. Local53focused SQL/API and46affected desktop/phone checks pass; those overlap aggregate suites. The prior fullunit465passed before one final installation-guard test was added. Actual final CI receipts replace pending status; no hosted or physical-device acceptance follows from fixture/PGlite checks.

The320px screenshot is the real responsive component with an explicit fictional athlete and fake transport. It shows configuration, not active notices. No customer data or credentials are included.

## Next exact gate

First restore ordinary supported rehearsal browser access without bypassing ERR_QUIC or denied management permissions. Existing023test-only approval remains received but install/test/rollback have not run because its normal-browser precondition is blocked. No repeat navigation without materially new evidence.

024would need a separate bounded approval for installation/configuration/rollback in isolated **ojcfrfpeftvngyluomex**, never production **iilbulpqbuknhdpmtrvm**. The minimal stage keeps all flagsOFF and uses existing six approved fictional identities to test Owner configuration and direct non-Owner denials, legacy compatibility, sibling isolation and guarded rollback. Any temporary flag activation or additional identities/fixtures for real release/reminder tests must be explicitly included in its own reviewed test bounds before execution. Source tests already exercise clock/DST, completion/pauses, deduplication, routing/opt-outs and rollback. Do not substitute forged SQL JWT claims for actual hosted Auth.

Production permission/media retention, usable DB/private-Storage recovery, reviewed media, scheduler dry-run/activation and physical-native acceptance remain separate gates. No new price, review-retention, rollover/refund or unlimited-storage promise is made.
