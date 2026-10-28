-- READ ONLY; verify the exact test project in the browser again.
select (select count(*) from pg_tables where schemaname='public') as public_tables,
 (select count(*) from pg_tables where schemaname='public' and tablename like 'learning_%') as learning_tables,
 (select count(*) from auth.users) as auth_users,(select count(*) from storage.objects) as storage_objects;
select enabled,scheduler_enabled,notices_enabled,youth_enabled,friday_time,low_ready_weeks from public.learning_settings;
select id,public,file_size_limit from storage.buckets order by id;
select has_function_privilege('authenticated','public.learning_tick(timestamptz,boolean)','EXECUTE') as authenticated_tick,
 has_table_privilege('anon','public.learning_quiz_keys','SELECT') as anon_keys,
 has_table_privilege('authenticated','public.learning_quiz_keys','SELECT') as authenticated_keys;
-- Expected: all four flags false; user/object counts0; buckets private; all three privilege values false.
-- This verifies schema/defaults only: NOT real Auth/JWT, Storage file API, signed URL or scheduler execution.
