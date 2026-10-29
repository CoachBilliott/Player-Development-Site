-- READ ONLY. Operator MUST first verify dashboard project ojcfrfpeftvngyluomex.
-- Never execute against production iilbulpqbuknhdpmtrvm.
-- Do not output passwords, API keys, auth metadata, tokens or customer rows.
begin read only;
select current_database() database_name,
 to_regprocedure('public.staff_athlete_service(uuid)') is not null has_service_detail,
 to_regprocedure('public.staff_can_view_service_athlete(uuid)') is not null has_scope_guard,
 to_regprocedure('public.effective_workout_assignment(uuid)') is not null has_assignment_helper,
 to_regprocedure('public.staff_client_service_roster_page(text,text,text,text,text,integer,integer)') is not null new_rpc_already_exists;
-- Expected six fictional identities only; stop for any mismatch, do not reset.
with expected(id,email) as(values
 ('17054a51-d756-4b9e-8048-c82973fe0c55'::uuid,'repformed-learning-owner@example.test'),
 ('134e7d0b-e54d-488b-8848-8254db86757c'::uuid,'repformed-learning-manager@example.test'),
 ('7853c212-2c83-4b6a-ab95-0c8fa81c75af'::uuid,'repformed-learning-coach@example.test'),
 ('2d136c01-ce7d-4c4d-b814-5af860dd707c'::uuid,'repformed-learning-other-coach@example.test'),
 ('dc6804e6-fc2f-4bb0-a7ca-de8514e09024'::uuid,'repformed-learning-parent@example.test'),
 ('2a566ee0-dd1f-4244-a16f-2c086bc1c6a2'::uuid,'repformed-learning-other-parent@example.test'))
select (select count(*) from auth.users) auth_user_count,
 count(*) matched_fictional_identities from expected e join auth.users u on u.id=e.id and u.email=e.email;
select enabled,scheduler_enabled,notices_enabled,youth_enabled from public.learning_settings;
select 'profiles' kind,count(*) row_count from public.player_profiles
union all select 'member_accounts',count(*) from public.member_accounts
union all select 'service_coaches',count(*) from public.athlete_service_coaches
union all select 'review_services',count(*) from public.review_services
union all select 'training_resources',count(*) from public.training_resources;
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef security_definer,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('staff_athlete_service','staff_can_view_service_athlete','effective_workout_assignment','staff_service_search','staff_client_service_roster_page');
commit;
