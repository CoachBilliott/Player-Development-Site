-- PREPARED ONLY: owner approval for seventh fictional Auth user + this fixture is PENDING.
-- Exact TEST project ojcfrfpeftvngyluomex; verify owner Dashboard URL/header first.
-- NO production, passwords, Auth-user creation, email, schema/policy/grant changes.
-- Prerequisite: approved owner UI Add user, exact email below, auto-confirm,
-- private owner-held temporary password, no invitation/recovery email.
-- Account role data is test-only under EXISTING permissions; this is not a new RPC grant.
-- Adds one adult profile. Existing six identities/history are preserved. Run once only.
begin;
do $fixture$
declare athlete_user uuid;
begin
 if (select count(*) from auth.users)<>7 or
 not exists(select 1 from auth.users u join public.account_roles r on r.user_id=u.id where u.id='17054a51-d756-4b9e-8048-c82973fe0c55' and lower(u.email)='repformed-learning-owner@example.test' and u.email_confirmed_at is not null and r.role='owner')
 or not exists(select 1 from auth.users u join public.account_roles r on r.user_id=u.id where u.id='134e7d0b-e54d-488b-8848-8254db86757c' and lower(u.email)='repformed-learning-manager@example.test' and u.email_confirmed_at is not null and r.role='manager')
 or not exists(select 1 from auth.users u join public.account_roles r on r.user_id=u.id where u.id='7853c212-2c83-4b6a-ab95-0c8fa81c75af' and lower(u.email)='repformed-learning-coach@example.test' and u.email_confirmed_at is not null and r.role='coach')
 or not exists(select 1 from auth.users u join public.account_roles r on r.user_id=u.id where u.id='2d136c01-ce7d-4c4d-b814-5af860dd707c' and lower(u.email)='repformed-learning-other-coach@example.test' and u.email_confirmed_at is not null and r.role='coach')
 or not exists(select 1 from auth.users u join public.account_roles r on r.user_id=u.id where u.id='dc6804e6-fc2f-4bb0-a7ca-de8514e09024' and lower(u.email)='repformed-learning-parent@example.test' and u.email_confirmed_at is not null and r.role='parent')
 or not exists(select 1 from auth.users u join public.account_roles r on r.user_id=u.id where u.id='2a566ee0-dd1f-4244-a16f-2c086bc1c6a2' and lower(u.email)='repformed-learning-other-parent@example.test' and u.email_confirmed_at is not null and r.role='parent')
 then raise exception 'STOP: existing six verified accounts/roles differ or seventh user is absent. Do not reset/reseed.';end if;
 select id into strict athlete_user from auth.users where lower(email)='repformed-learning-athlete@example.test' and email_confirmed_at is not null;
 if (select count(*) from public.account_roles)<>6 or (select count(*) from public.player_profiles)<>3
 or exists(select 1 from public.account_roles where user_id=athlete_user)
 or exists(select 1 from public.member_accounts where user_id=athlete_user)
 or exists(select 1 from public.player_profiles where owner_id=athlete_user or id='93000000-0000-4000-8000-000000000013')
 then raise exception 'STOP: unexpected or already-created fixture; inspect prior result before any retry.';end if;
 if exists(select 1 from public.learning_settings where enabled or scheduler_enabled or notices_enabled or youth_enabled)
 or exists(select 1 from public.staff_notification_settings where email_enabled or inapp_observation_enabled)
 or exists(select 1 from public.interest_intake_settings where enabled)
 or exists(select 1 from public.delivery_monitor_settings where enabled)
 or exists(select 1 from public.profile_settings where under18_enabled or child_self_access_enabled)
 then raise exception 'STOP: excluded test capability is enabled.';end if;
 -- Fixture timestamps below are fictional setup, not real acceptance of legal terms.
 insert into public.member_accounts(user_id,account_type,privacy_version) values(athlete_user,'adult','rehearsal-fictional-v1');
 insert into public.account_roles(user_id,role) values(athlete_user,'athlete');
 insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal)
 values('93000000-0000-4000-8000-000000000013',athlete_user,'Fictional Taylor','18+','Quarterback','New to the game','Footwork');
end $fixture$;
commit;
-- Bounded nonsecret postflight. Expect7 roles,4 profiles,all four learning flagsfalse.
select (select count(*) from public.account_roles) as roles,(select count(*) from public.player_profiles) as profiles,
 enabled,scheduler_enabled,notices_enabled,youth_enabled from public.learning_settings;
-- No automatic plan, service coach, entitlement, consent, quota or paid credit.
-- Use normal Owner UI to assign test data after separate feature-session approval.
