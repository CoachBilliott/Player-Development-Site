-- PREPARED READ-ONLY CHECK; not executed against a hosted project by this task.
-- First verify the signed-in dashboard URL/header is ojcfrfpeftvngyluomex.
-- A target literal/current_database() is NOT proof of project identity.
-- NEVER run in production iilbulpqbuknhdpmtrvm. No passwords/tokens/file paths returned.
-- Existing fixtures must be inspected, not reset/reseeded or silently repaired.
begin read only;
with approved(id,email,expected_role) as (values
 ('17054a51-d756-4b9e-8048-c82973fe0c55'::uuid,'repformed-learning-owner@example.test','owner'),
 ('134e7d0b-e54d-488b-8848-8254db86757c'::uuid,'repformed-learning-manager@example.test','manager'),
 ('7853c212-2c83-4b6a-ab95-0c8fa81c75af'::uuid,'repformed-learning-coach@example.test','coach'),
 ('2d136c01-ce7d-4c4d-b814-5af860dd707c'::uuid,'repformed-learning-other-coach@example.test','coach'),
 ('dc6804e6-fc2f-4bb0-a7ca-de8514e09024'::uuid,'repformed-learning-parent@example.test','parent'),
 ('2a566ee0-dd1f-4244-a16f-2c086bc1c6a2'::uuid,'repformed-learning-other-parent@example.test','parent')
)
select (select count(*) from auth.users)=6 as exactly_six_accounts,
 not exists(select 1 from auth.users u left join approved a on u.id=a.id and lower(u.email)=a.email where a.id is null or u.email_confirmed_at is null) as exact_confirmed_identity_pairs,
 (select count(*) from public.player_profiles)=3 and
 (select count(*) from public.player_profiles where id in ('93000000-0000-4000-8000-000000000010','93000000-0000-4000-8000-000000000011','93000000-0000-4000-8000-000000000012') and age_group='18+')=3 as three_existing_fictional_adult_profiles,
 (select count(*) from public.account_roles)=6 and not exists(select 1 from approved a left join public.account_roles r on r.user_id=a.id where r.role is distinct from a.expected_role) as exact_existing_role_mapping;

select enabled,scheduler_enabled,notices_enabled,youth_enabled,friday_time,low_ready_weeks from public.learning_settings;
-- All four flags MUST be false before any newly approved acceptance session.
select email_enabled,inapp_observation_enabled from public.staff_notification_settings;
select enabled as intake_enabled from public.interest_intake_settings;
select enabled as monitoring_enabled from public.delivery_monitor_settings;
select under18_enabled,child_self_access_enabled from public.profile_settings;
-- All excluded capabilities above MUST remain false.

select (select count(*) from public.learning_plans) as plans,
 (select count(*) from public.learning_week_versions) as week_versions,
 (select count(*) from public.learning_quizzes) as quizzes,
 (select count(*) from public.learning_quiz_versions) as quiz_versions,
 (select count(*) from public.learning_enrollments) as enrollments,
 (select count(*) from public.learning_releases) as releases,
 (select count(*) from public.learning_quiz_attempts) as attempts,
 (select count(*) from public.learning_quiz_grades) as grade_revisions,
 (select count(*) from public.training_resources) as training_resources,
 (select count(*) from storage.objects) as stored_objects;
-- Preserve counts/history. Zero quizzes/attempts/enrollments was last verified12:21UTC,
-- not a required destructive reset or a claim about later activity.

select count(*) as learning_tables,
 count(*) filter(where not c.relrowsecurity) as learning_tables_without_rls
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname like 'learning_%';
select has_function_privilege('authenticated','public.learning_tick(timestamptz,boolean)','EXECUTE') as authenticated_tick,
 has_table_privilege('anon','public.learning_quiz_keys','SELECT') as anonymous_quiz_keys,
 has_table_privilege('authenticated','public.learning_quiz_keys','SELECT') as authenticated_quiz_keys;
-- Expected18 learning tables, zero without RLS, all three privileges false.
select id,public,file_size_limit from storage.buckets order by id;
-- Existing two buckets must remain private. Do not alter limits or read media here.
rollback;
