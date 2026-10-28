-- TEST ONLY ojcfrfpeftvngyluomex. Confirm browser URL/header before running.
-- Requires the six owner-approved disposable Auth users created through the
-- documented Auth UI with no outgoing email. Contains NO passwords/API keys.
-- Run once, entire file. Refuses existing application fixtures; no overwrite/reset.
begin;
do $guard$ begin
 if (select count(*) from auth.users)<>6 or exists(select 1 from auth.users where lower(email) not in (
 'repformed-learning-owner@example.test','repformed-learning-manager@example.test',
 'repformed-learning-coach@example.test','repformed-learning-other-coach@example.test',
 'repformed-learning-parent@example.test','repformed-learning-other-parent@example.test'))
 or exists(select 1 from auth.users where email_confirmed_at is null)
 then raise exception 'STOP: require exactly six confirmed disposable fixture users, no other users.';end if;
 if exists(select 1 from public.account_roles) or exists(select 1 from public.member_accounts)
 or exists(select 1 from public.player_profiles) or exists(select 1 from public.training_resources)
 or exists(select 1 from public.learning_enrollments) or exists(select 1 from storage.objects)
 then raise exception 'STOP: fixture state is not empty. Inspect; do not reset or rerun.';end if;
 if (select count(*) from public.learning_settings)<>1 or exists(select 1 from public.learning_settings where enabled or scheduler_enabled or notices_enabled or youth_enabled)
 then raise exception 'STOP: require installed, disabled learning schema.';end if;
end $guard$;
insert into public.account_roles(user_id,role)
 select id,case lower(email)
 when 'repformed-learning-owner@example.test' then 'owner'
 when 'repformed-learning-manager@example.test' then 'manager'
 when 'repformed-learning-coach@example.test' then 'coach'
 when 'repformed-learning-other-coach@example.test' then 'coach'
 else 'parent' end from auth.users;
-- Fictional setup timestamps are not evidence of a real person's legal consent.
insert into public.member_accounts(user_id,account_type,privacy_version)
 select id,'parent','rehearsal-fictional-v1' from auth.users where lower(email) in ('repformed-learning-parent@example.test','repformed-learning-other-parent@example.test');
insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal)
 select '93000000-0000-4000-8000-000000000010',id,'Fictional Avery','18+','Quarterback','New to the game','Footwork' from auth.users where lower(email)='repformed-learning-parent@example.test';
insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal)
 select '93000000-0000-4000-8000-000000000011',id,'Fictional Jordan','18+','Quarterback','New to the game','Footwork' from auth.users where lower(email)='repformed-learning-parent@example.test';
insert into public.player_profiles(id,owner_id,nickname,age_group,position,experience,goal)
 select '93000000-0000-4000-8000-000000000012',id,'Fictional Other','18+','Quarterback','New to the game','Footwork' from auth.users where lower(email)='repformed-learning-other-parent@example.test';
insert into public.athlete_service_coaches(profile_id,coach_id)
 select '93000000-0000-4000-8000-000000000010',id from auth.users where lower(email)='repformed-learning-coach@example.test';
insert into public.athlete_service_coaches(profile_id,coach_id)
 select p.id,u.id from public.player_profiles p cross join auth.users u
 where p.id in ('93000000-0000-4000-8000-000000000011','93000000-0000-4000-8000-000000000012') and lower(u.email)='repformed-learning-other-coach@example.test';
commit;
select 'fictional setup only' as receipt,(select count(*) from auth.users) as auth_users,
 (select count(*) from public.account_roles) as roles,(select count(*) from public.player_profiles) as adult_profiles;
-- Expected6,6,3. Learning/scheduler/notices/youth/email remain off.
