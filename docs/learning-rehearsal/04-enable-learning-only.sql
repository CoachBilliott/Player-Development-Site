-- OPERATOR REVIEW REQUEST, NOT EXECUTED. Test project ojcfrfpeftvngyluomex ONLY.
-- Verify exact browser project URL/header; do not run in iilbulpqbuknhdpmtrvm.
-- Requested transition: learning enabled=true for synthetic adult API acceptance.
-- Scheduler/notices/youth/email/intake/monitoring remain false; no Cron/job/function deploy.
begin;
do $guard$ begin
 if (select count(*) from auth.users)<>6 or exists(select 1 from auth.users where lower(email) not in (
 'repformed-learning-owner@example.test','repformed-learning-manager@example.test',
 'repformed-learning-coach@example.test','repformed-learning-other-coach@example.test',
 'repformed-learning-parent@example.test','repformed-learning-other-parent@example.test'))
 then raise exception 'STOP: unexpected Auth users; this is not the approved fixture target.';end if;
 if (select count(*) from public.player_profiles where id in ('93000000-0000-4000-8000-000000000010','93000000-0000-4000-8000-000000000011','93000000-0000-4000-8000-000000000012') and age_group='18+')<>3
 or (select count(*) from public.player_profiles)<>3 then raise exception 'STOP: unexpected profile fixture scope.';end if;
 if exists(select 1 from public.learning_settings where scheduler_enabled or notices_enabled or youth_enabled)
 or exists(select 1 from public.staff_notification_settings where email_enabled or inapp_observation_enabled)
 or exists(select 1 from public.interest_intake_settings where enabled)
 or exists(select 1 from public.delivery_monitor_settings where enabled)
 or exists(select 1 from public.profile_settings where under18_enabled or child_self_access_enabled)
 then raise exception 'STOP: an excluded capability is enabled.';end if;
end $guard$;
update public.learning_settings set enabled=true where singleton;
commit;
select enabled,scheduler_enabled,notices_enabled,youth_enabled,friday_time,low_ready_weeks from public.learning_settings;
-- Expectedtrue,false,false,false,17:00,2. Rollback switch (separate explicit operator action):
-- update public.learning_settings set enabled=false where singleton;
-- Do not drop learning/history tables or retained originals.
