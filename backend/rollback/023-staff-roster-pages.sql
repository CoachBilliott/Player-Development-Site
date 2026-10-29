-- Reviewed rollback candidate only. No production execution is implied.
-- Drops only the new read capability; existing service helpers/data remain.
-- New clients handle PGRST202 with the existing authorized legacy roster.
-- They NEVER fall back on authorization denial or an invalid server response.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
drop function if exists public.staff_client_service_roster_page(text,text,text,text,text,integer,integer);
drop function if exists public.staff_service_search(text);
-- Keep the two harmless additive indexes. Remove them only after confirming
-- their definitions/ownership separately; do not delete pre-existing indexes.
notify pgrst,'reload schema';
commit;
