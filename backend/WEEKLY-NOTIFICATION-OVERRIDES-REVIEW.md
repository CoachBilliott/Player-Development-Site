# Draft024: weekly notification inheritance

**Source preparation only. No hosted application, scheduler, sends, credential changes or native release. The owner-approved023test rehearsal does NOT authorize024. Do not apply a numbered-migration glob.**

This closes the draft scheduler's global-only preference gap. It does not complete hosted delivery, identity, Storage, media or recovery acceptance. Production and TestFlight15 remain0816c343.

## Exact source change and role/data scope

Requires existing016and learning019–022;023is independent. Adds:

- `weekly_rules jsonb not null default '{}'` to existing `delivery_packages`, `delivery_client_settings`, `delivery_athlete_settings`.
- Nullable `weekly_package_id uuid` foreign key on athlete settings, so siblings may choose different **notification-default packages**. This is not a billing, learning-eligibility or enrollment change. Existing table RLS/raw grants remain unchanged. No media, retention, bucket or quota change.
- Private internal `learning_validate_notification_rule(jsonb)` and `learning_notification_rules(uuid)` helpers, revoked from Public/anon/authenticated.
- Authenticated Execute on two guarded **Owner-only** RPCs: `learning_notification_workspace(uuid)` and `learning_save_notification_rule(text,uuid,uuid,jsonb,integer,uuid)`. Current DB role/closing-account and profile-scope guards run server-side; no client role is trusted. No account role is granted or changed. Managers/Coaches retain their existing scoped service metadata, but gain no configuration write authority or global package catalog from these RPCs.
- Existing `learning_tick` and `learning_inbox` use resolved preferences. Their original callable roles and data scope remain: ordinary users cannot invoke the scheduler; learners see only their own authorized notices; Coaches see assigned athletes only. Owner/Manager visibility stays unchanged. Staff capacity notifications additionally honor the existing assigned-coach versus Owners/Managers routing preference.

The effective order is **global → selected package → household → athlete**. A selected athlete package replaces the household package base, then explicit household/athlete preferences still apply. Blank override fields inherit. Supported new weekly keys are Friday time (minute precision), Friday reminder enabled, and ready-week warning threshold1–8. Existing `notify_training`/`routing` fields supply training-ready notice and staff routing preferences. Friday remains America/Chicago; Sunday00:00Chicago release logic and DST behavior are unchanged. Manual late-delivery deadlines/grace/time zones and missing-submission reminders remain separate; those submission reminders stay disabled.

Monitoring pause/cancel state is distinct from plan pause. Existing enrollment/eligibility controls govern weekly release/reminder pauses and access expiry. Preferences do not grant access, pause a plan, send email/push or change scheduler flags. Configuration is Owner-only; the selected-athlete detail and settings use the same small progressive-disclosure editor.

## Compatibility, idempotency and privacy

Weekly preferences are separate columns, not unknown keys injected into the old strict delivery-rule JSON. Older clients ignore extra row properties and their existing save RPCs preserve weekly preferences and package selection. Package and household locks share the existing advisory keys. Existing row versions reject stale writes; a lost-response retry with the same desired patch/version is a no-op, with one audit event. Invalid/unknown keys, unsupported scopes, wrong package IDs and malformed values fail before mutation. New RPC failure never falls back to an unauthorized or differently scoped save. Only missing capability PGRST202 is shown as unavailable for reads; Auth/permission/response errors stay explicit.

No new PII fields, child enrollment, private clip grants, public raw table reads, new identities or credentials. Preference audits store actor/scope/target/version, not passwords, tokens or media URLs. The package chooser is explicit configuration and must never be labeled a purchase.

## Review/rehearsal gate

Before any hosted024execution, obtain its own exact approval for the four columns, guarded RPCs and changed future-notice logic against the verified isolated project **ojcfrfpeftvngyluomex**. Confirm existing schema and all learning/scheduler/notices/youth flags, actual supported browser/Auth access, six approved identities and recovery. Do not reuse023authorization, retry a denied management route or substitute privileged access for ordinary Auth. No new accounts, role changes or mass fixtures are included without their own bounds.

Rehearse package/household/athlete precedence, sibling package differences, changing rules without duplicate Friday notices, opt-out/old-notice resolution, Chicago DST boundaries, paused/completed/inactive work, partial failures, eligible published content only, staff routing/revocation and direct cross-role denials. Check legacy save compatibility and rollback preserving preferences/releases/grades. Local PGlite/HTTP fixtures are source checks, not actual JWT/Storage acceptance. Public intake/homepage/consent/one shared-inbox email remain regression gates.

Production **iilbulpqbuknhdpmtrvm** needs separate review of the final combined019–022/024permissions/media/recovery scope and actual acceptance before activation. No production024authorization is recorded. Do not turn on standing Cron or notifications as part of applying source SQL.

## Safe rollback

[rollback/024-weekly-notification-overrides.sql](rollback/024-weekly-notification-overrides.sql) requires learning, scheduler, notices and youth flags already OFF; it aborts if any is on. This prevents restoring global-only reminders over saved opt-outs. It restores the former tick/inbox functions and drops only the new Owner/helper RPCs without CASCADE, leaving all preferences, columns, accounts, releases and grades intact. Do not delete history or automatically remove media policies. Do not re-enable the old global-only module with stored opt-outs until forward compatibility is reviewed. Runtime/source rollback and actual provider DB/private-media restore are separate acceptance requirements.

The migration and rollback use a5second lock/60second statement timeout and one transaction. Stop on dependency/lock errors or uncertain outcomes. No destructive reset, credential or paid resource is part of recovery.
