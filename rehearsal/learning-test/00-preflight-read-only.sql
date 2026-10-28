-- READ ONLY. In the browser, verify project URL/header ojcfrfpeftvngyluomex first.
-- A SQL literal is NOT proof of the selected project. Never run in production iilbulpqbuknhdpmtrvm.
select (select count(*) from pg_tables where schemaname='public') as public_tables,
 (select count(*) from auth.users) as auth_users,
 (select count(*) from storage.buckets) as storage_buckets,
 (select count(*) from storage.objects) as storage_objects,
 to_regclass('public.learning_settings') is not null as learning_installed;
-- Required: 0,0,0,0,false. Otherwise STOP; no reset, deletion or blind rerun.
