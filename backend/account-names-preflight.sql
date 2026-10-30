-- Read-only METADATA preflight for an explicitly verified existing TEST target.
-- This file does not establish project identity: verify the connection's project
-- ref independently before execution. Do not execute against production here.
-- No account rows, names, emails, profiles or other application records are read.
begin read only;

select current_database() as database_name, current_setting('server_version') as postgres_version;

with required(name) as (values
  ('public.member_accounts'), ('public.account_roles'),
  ('public.guardian_managed_athletes'), ('public.account_closures'))
select name, to_regclass(name) is not null as present from required order by name;

with required(signature) as (values
  ('public.list_account_access(text)'), ('public.current_account_role()'),
  ('public.account_is_closing(uuid)'))
select signature, to_regprocedure(signature) is not null as present from required order by signature;

select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name in
  ('member_accounts','account_roles','guardian_managed_athletes','account_closures','account_names')
order by table_name,ordinal_position;

-- Owner scope/authorization is inherited from the installed v1 listing.
-- Review these function definitions/grants before approving the delta.
select p.oid::regprocedure::text as signature, p.prosecdef, p.proconfig,
       p.proacl::text as grants, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('list_account_access','current_account_role','account_is_closing',
   'can_save_account_name','get_my_account_name','save_my_account_name','list_account_access_v2')
order by signature;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename in
  ('member_accounts','account_roles','guardian_managed_athletes','account_closures','account_names')
order by tablename,policyname;

select c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
  ('member_accounts','account_roles','guardian_managed_athletes','account_closures','account_names')
order by c.relname;

select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in
  ('member_accounts','account_roles','guardian_managed_athletes','account_closures','account_names')
order by table_name,grantee,privilege_type;

select conname,pg_get_constraintdef(oid) as definition from pg_constraint
where conrelid=to_regclass('public.account_names') order by conname;

select to_regclass('public.account_names') as existing_names_table,
       to_regprocedure('public.can_save_account_name()') as existing_eligibility_helper,
       to_regprocedure('public.get_my_account_name()') as existing_name_reader,
       to_regprocedure('public.save_my_account_name(text,integer,uuid)') as existing_name_writer,
       to_regprocedure('public.list_account_access_v2(text)') as existing_v2_directory,
       to_regclass('supabase_migrations.schema_migrations') as migration_ledger;
-- Any missing prerequisite or existing name object requires review; this is not
-- permission to repair, drop, replay or reset anything. All names objects should
-- be absent before the first application, and present on postflight.
commit;
