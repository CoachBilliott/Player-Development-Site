-- READ ONLY metadata; not proof of real Auth/JWT role behavior.
-- Operator must verify isolated project ojcfrfpeftvngyluomex before execution.
begin read only;
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef security_definer,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('staff_service_search','staff_client_service_roster_page');
select has_function_privilege('authenticated','public.staff_client_service_roster_page(text,text,text,text,text,integer,integer)','execute') authenticated_may_invoke_guarded_rpc,
 has_function_privilege('anon','public.staff_client_service_roster_page(text,text,text,text,text,integer,integer)','execute') anon_execute_must_be_false,
 has_function_privilege('authenticated','public.staff_service_search(text)','execute') authenticated_helper_execute_must_be_false;
select indexname,indexdef from pg_indexes where schemaname='public' and indexname in ('athlete_service_coaches_staff_page','review_services_staff_page');
select enabled,scheduler_enabled,notices_enabled,youth_enabled from public.learning_settings;
commit;
