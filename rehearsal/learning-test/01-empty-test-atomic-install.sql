-- TEST ONLY: ojcfrfpeftvngyluomex, Repformed starter. PRODUCTION EXCLUDED: iilbulpqbuknhdpmtrvm
-- Verify exact browser project URL/header BEFORE execution. Run entire file, no selection.
-- All19 files wrapped in ONE transaction; any error rolls back the whole batch.
-- Source 59ac534a47816b83473795aa372ba34298539dd0; no013/014; no users, credentials, actual file uploads, email, cron or activation.
begin;
do $guard$ begin
 if exists(select 1 from pg_tables where schemaname='public')
 or exists(select 1 from auth.users) or exists(select 1 from storage.buckets)
 or exists(select 1 from storage.objects) then
  raise exception 'STOP: target is not empty. Do not reset or run this bundle. Verify project ojcfrfpeftvngyluomex in browser.';
 end if;
 if to_regclass('supabase_migrations.schema_migrations') is not null then
  if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='supabase_migrations' and c.relname='schema_migrations') then
   declare ledger_count integer;begin execute 'select count(*) from supabase_migrations.schema_migrations' into ledger_count;
   if ledger_count>0 then raise exception 'STOP: migration history is not empty.';end if;end;
  end if;
 end if;
end $guard$;

-- SOURCE 001-shared-content.sql SHA256 bd62bb90d1d291642122c04b13f2a1950d7af9de48ad6ae3d35d19de06e17a4e
-- REVIEW BEFORE APPLYING. This file has not been run against a live service.
-- Use a separate, empty Supabase project for Player Development only.

create table public.coach_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.coach_members enable row level security;
revoke all on public.coach_members from anon, authenticated;
grant select on public.coach_members to authenticated;
create policy "Coaches can check their own membership" on public.coach_members
  for select to authenticated using (user_id = auth.uid());
-- No browser policy grants INSERT, UPDATE or DELETE on the membership allowlist.

create function public.valid_training_content(d jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(d) = 'object'
    and d->>'sport' = 'football'
    and length(btrim(d->>'title')) between 1 and 90
    and d->>'skill' in ('Coordination', 'Footwork', 'Ball skills', 'Game understanding')
    and jsonb_typeof(d->'ages') = 'array' and jsonb_array_length(d->'ages') between 1 and 4
    and not exists (select 1 from jsonb_array_elements_text(d->'ages') a where a not in ('5–7', '8–12', '13–17', '18+'))
    and jsonb_typeof(d->'levels') = 'array' and jsonb_array_length(d->'levels') between 1 and 3
    and not exists (select 1 from jsonb_array_elements_text(d->'levels') l where l not in ('New to the game', 'Building fundamentals', 'Experienced'))
    and jsonb_typeof(d->'positions') = 'array' and jsonb_array_length(d->'positions') <= 8
    and not exists (select 1 from jsonb_array_elements_text(d->'positions') p where p not in ('Explore all positions', 'Quarterback', 'Wide receiver', 'Running back', 'Offensive line', 'Defensive line', 'Linebacker', 'Defensive back'))
    and jsonb_typeof(d->'minutes') = 'number' and (d->>'minutes')::numeric between 1 and 20
    and jsonb_typeof(d->'steps') = 'array' and jsonb_array_length(d->'steps') between 1 and 100
    and not exists (select 1 from jsonb_array_elements(d->'steps') s where jsonb_typeof(s) <> 'string' or length(btrim(s #>> '{}')) not between 1 and 4000)
    and length((d->'steps')::text) <= 10000
    and jsonb_typeof(d->'equipment') = 'string' and length(d->>'equipment') <= 500
    and jsonb_typeof(d->'lesson') = 'string' and length(d->>'lesson') <= 2000
    and jsonb_typeof(d->'cue') = 'string' and length(d->>'cue') <= 500
    and d->>'kind' in ('movement', 'hands', 'read');
$$;

create table public.training_resources (
  id uuid primary key,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  content jsonb not null check (public.valid_training_content(content) is true),
  asset_path text not null unique check (asset_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm|png|jpg|webp|pdf|txt)$'),
  asset_type text not null check (asset_type in ('video/mp4','video/webm','image/png','image/jpeg','image/webp','application/pdf','text/plain')),
  asset_name text not null check (length(asset_name) between 1 and 180)
);
create function public.bump_training_resource_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger training_resource_version before update on public.training_resources
  for each row execute function public.bump_training_resource_version();
alter table public.training_resources enable row level security;
revoke all on public.training_resources from anon, authenticated;
grant select on public.training_resources to anon;
grant select, insert, update, delete on public.training_resources to authenticated;
create policy "Visitors read published training only" on public.training_resources
  for select to authenticated using (status = 'published' or exists (select 1 from public.coach_members where user_id = auth.uid()));
create policy "Visitors read published training" on public.training_resources
  for select to anon using (status = 'published');
create policy "Approved coaches create training" on public.training_resources
  for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.coach_members where user_id = auth.uid()));
create policy "Approved coaches edit training" on public.training_resources
  for update to authenticated using (exists (select 1 from public.coach_members where user_id = auth.uid()))
  with check (exists (select 1 from public.coach_members where user_id = auth.uid()));
create policy "Approved coaches remove training" on public.training_resources
  for delete to authenticated using (exists (select 1 from public.coach_members where user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-media', 'training-media', false, 12582912, array['video/mp4','video/webm','image/png','image/jpeg','image/webp','application/pdf','text/plain']);
create policy "Published training media can be signed for reading" on storage.objects
  for select to authenticated using (bucket_id = 'training-media' and (
    exists (select 1 from public.training_resources r where r.asset_path = name and r.status = 'published')
    or exists (select 1 from public.coach_members where user_id = auth.uid())
  ));
create policy "Visitors read published training media" on storage.objects
  for select to anon using (bucket_id = 'training-media' and exists (select 1 from public.training_resources r where r.asset_path = name and r.status = 'published'));
create policy "Approved coaches upload to their own folder" on storage.objects
  for insert to authenticated with check (bucket_id = 'training-media' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.coach_members where user_id = auth.uid()));
create policy "Approved coaches remove training media" on storage.objects
  for delete to authenticated using (bucket_id = 'training-media' and exists (select 1 from public.coach_members where user_id = auth.uid()));


-- SOURCE 002-private-profiles.sql SHA256 a67eb9cf5844594e543338ec8cc78f891835cfc22c1bebfb6656c9a5f3f7d72c
-- Apply AFTER 001-shared-content.sql in the dedicated Player Development project.
-- No live project has been configured by this migration file alone.

-- A website flag is not a security boundary. Keep collection of under-18
-- profiles closed at the database until consent/privacy review is complete.
create table public.profile_settings (
  singleton boolean primary key default true check (singleton),
  under18_enabled boolean not null default false
);
insert into public.profile_settings default values;
alter table public.profile_settings enable row level security;
revoke all on public.profile_settings from anon, authenticated;
grant select on public.profile_settings to authenticated;
create policy "Members read enrollment availability" on public.profile_settings
  for select to authenticated using (true);

create table public.member_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('parent', 'adult')),
  adult_confirmed_at timestamptz not null default now(),
  privacy_acknowledged_at timestamptz not null default now(),
  privacy_version text not null default 'profile-pilot-2026-10',
  created_at timestamptz not null default now()
);
alter table public.member_accounts enable row level security;
revoke all on public.member_accounts from anon, authenticated;
grant select on public.member_accounts to authenticated;
create policy "Members read only their own account" on public.member_accounts
  for select to authenticated using (user_id = auth.uid());

-- The browser cannot write roles, timestamps, ownership or consent versions.
-- Email confirmation is verified against Auth, never trusted from user metadata.
create function public.complete_member_account(kind text, adult_confirmed boolean, privacy_acknowledged boolean)
returns public.member_accounts language plpgsql security definer set search_path = '' as $$
declare result public.member_accounts;
begin
  if auth.uid() is null or not exists (
    select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null
  ) then raise exception 'Verify your email before setting up an account.'; end if;
  if kind not in ('parent', 'adult') or adult_confirmed is distinct from true or privacy_acknowledged is distinct from true
    then raise exception 'An adult account and privacy acknowledgement are required.'; end if;
  insert into public.member_accounts(user_id, account_type) values(auth.uid(), kind)
    on conflict (user_id) do nothing;
  select * into result from public.member_accounts where user_id = auth.uid();
  if result.account_type <> kind then raise exception 'Account type is already set. Contact support to change it.'; end if;
  return result;
end;
$$;
revoke all on function public.complete_member_account(text, boolean, boolean) from public, anon;
grant execute on function public.complete_member_account(text, boolean, boolean) to authenticated;

create table public.player_profiles (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references public.member_accounts(user_id) on delete cascade,
  nickname text not null check (length(btrim(nickname)) between 1 and 40),
  age_group text not null check (age_group in ('5–7','8–12','13–17','18+')),
  sport text not null default 'football' check (sport = 'football'),
  position text not null check (position in ('Explore all positions','Quarterback','Wide receiver','Running back','Offensive line','Defensive line','Linebacker','Defensive back')),
  experience text not null check (experience in ('New to the game','Building fundamentals','Experienced')),
  goal text not null check (goal in ('Coordination','Footwork','Ball skills','Game understanding')),
  guardian_confirmed boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_group = '18+' or guardian_confirmed)
);
create index player_profiles_owner_idx on public.player_profiles(owner_id);
create function public.guard_player_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.id <> old.id or new.owner_id <> old.owner_id or new.created_at <> old.created_at
      then raise exception 'Profile ownership cannot be changed.'; end if;
    new.version := old.version + 1;
  else
    new.version := 1;
    new.created_at := now();
  end if;
  new.updated_at := now();
  if new.age_group <> '18+' and not exists (
    select 1 from public.profile_settings where under18_enabled
  ) then raise exception 'Under-18 enrollment is not open yet.'; end if;
  if not exists (
    select 1 from public.member_accounts a where a.user_id = new.owner_id
      and (new.age_group = '18+' or a.account_type = 'parent')
  ) then raise exception 'Under-18 profiles require a parent account.'; end if;
  return new;
end;
$$;
create trigger player_profile_guard before insert or update on public.player_profiles
  for each row execute function public.guard_player_profile();
alter table public.player_profiles enable row level security;
revoke all on public.player_profiles from anon, authenticated;
grant select, insert, update, delete on public.player_profiles to authenticated;
create policy "Owners read private profiles" on public.player_profiles for select to authenticated using (owner_id = auth.uid());
create policy "Owners create private profiles" on public.player_profiles for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners update private profiles" on public.player_profiles for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete private profiles" on public.player_profiles for delete to authenticated using (owner_id = auth.uid());

-- No coach or administrator gets access to player information through these policies.
-- This deliberately deletes member data only; Auth removal requires a trusted service
-- so that published coaching resources are not accidentally orphaned/deleted.
create function public.delete_member_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  delete from public.member_accounts where user_id = auth.uid();
end;
$$;
revoke all on function public.delete_member_data() from public, anon;
grant execute on function public.delete_member_data() to authenticated;

-- SOURCE 003-account-levels.sql SHA256 604fe287c296bc758669512cd07acff2f6abd39a93b9c7eea223923bc94f76ee
-- Apply once after 001 and 002 in the dedicated Player Development project.
create table public.account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','coach','parent','athlete')),
  version integer not null default 1 check (version > 0),
  granted_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.account_roles enable row level security;
revoke all on public.account_roles from anon, authenticated;
grant select on public.account_roles to authenticated;
create policy "Read own account level" on public.account_roles for select to authenticated using (user_id=auth.uid());

create function public.current_account_role() returns text language sql stable security definer set search_path='' as $$
  select role from public.account_roles where user_id=auth.uid();
$$;
revoke all on function public.current_account_role() from public, anon;
grant execute on function public.current_account_role() to authenticated;
create function public.can_edit_training(creator uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(public.current_account_role() in ('owner','manager') or (public.current_account_role()='coach' and creator=auth.uid()),false);
$$;
revoke all on function public.can_edit_training(uuid) from public, anon;
grant execute on function public.can_edit_training(uuid) to authenticated;

create table public.account_role_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete cascade,
  previous_role text,
  new_role text not null,
  changed_at timestamptz not null default now()
);
alter table public.account_role_audit enable row level security;
revoke all on public.account_role_audit from anon, authenticated;
grant select on public.account_role_audit to authenticated;
create policy "Owners read access audit" on public.account_role_audit for select to authenticated using (public.current_account_role()='owner');
create function public.prepare_account_access() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    new.user_id:=old.user_id;
    new.version:=old.version+1;
  else new.version:=1; end if;
  new.updated_at:=now();
  new.granted_by:=auth.uid();
  return new;
end;
$$;
revoke all on function public.prepare_account_access() from public, anon, authenticated;
create trigger account_access_version before insert or update on public.account_roles for each row execute function public.prepare_account_access();
create function public.sync_account_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.account_role_audit(actor_id,target_id,previous_role,new_role)
    values(auth.uid(),new.user_id,case when TG_OP='UPDATE' then old.role else null end,new.role);
  if new.role in ('owner','manager','coach') then
    insert into public.coach_members(user_id) values(new.user_id) on conflict do nothing;
  else delete from public.coach_members where user_id=new.user_id; end if;
  return new;
end;
$$;
revoke all on function public.sync_account_access() from public, anon, authenticated;
create trigger account_access_sync after insert or update on public.account_roles for each row execute function public.sync_account_access();
-- Existing staff are preserved; an owner is bootstrapped separately by trusted administration.
insert into public.account_roles(user_id,role) select user_id,'coach' from public.coach_members;
insert into public.account_roles(user_id,role)
  select user_id,case account_type when 'parent' then 'parent' else 'athlete' end from public.member_accounts
  on conflict (user_id) do nothing;

create or replace function public.complete_member_account(kind text, adult_confirmed boolean, privacy_acknowledged boolean)
returns public.member_accounts language plpgsql security definer set search_path='' as $$
declare result public.member_accounts;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
    then raise exception 'Verify your email before setting up an account.'; end if;
  if kind not in ('parent','adult') or adult_confirmed is distinct from true or privacy_acknowledged is distinct from true
    then raise exception 'An adult account and privacy acknowledgement are required.'; end if;
  if exists(select 1 from public.account_roles where user_id=auth.uid() and ((role='parent' and kind<>'parent') or (role='athlete' and kind<>'adult')))
    then raise exception 'Your account level is already set. Ask an Owner to change Parent or Athlete access.'; end if;
  insert into public.member_accounts(user_id,account_type) values(auth.uid(),kind) on conflict do nothing;
  select * into result from public.member_accounts where user_id=auth.uid();
  if result.account_type<>kind then raise exception 'Account type is already set. Contact the owner to change it.'; end if;
  insert into public.account_roles(user_id,role) values(auth.uid(),case kind when 'parent' then 'parent' else 'athlete' end) on conflict do nothing;
  return result;
end;
$$;

create function public.enforce_athlete_profile_limit() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
  if exists(select 1 from public.account_roles where user_id=new.owner_id and role='athlete') then
    if new.age_group<>'18+' then raise exception 'Athlete accounts currently require an adult profile.'; end if;
    if exists(select 1 from public.player_profiles where owner_id=new.owner_id and id<>new.id)
      then raise exception 'Athlete accounts can manage one personal profile. Ask the owner for Parent access to manage a family.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_athlete_profile_limit() from public, anon, authenticated;
create trigger athlete_profile_limit before insert or update on public.player_profiles for each row execute function public.enforce_athlete_profile_limit();

create function public.list_account_access(search_text text default '')
returns table(user_id uuid,email text,role text,version integer,email_verified boolean,adult_setup boolean)
language plpgsql security definer set search_path='' as $$
begin
  if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.'; end if;
  return query select u.id,u.email::text,r.role,coalesce(r.version,0),u.email_confirmed_at is not null,a.adult_confirmed_at is not null
    from auth.users u left join public.account_roles r on r.user_id=u.id left join public.member_accounts a on a.user_id=u.id
    where u.email is not null and (btrim(search_text)='' or position(lower(left(btrim(search_text),254)) in lower(u.email))>0)
    order by u.email limit 50;
end;
$$;
revoke all on function public.list_account_access(text) from public, anon;
grant execute on function public.list_account_access(text) to authenticated;

create function public.assign_account_role(target_user uuid,new_role text,expected_version integer)
returns public.account_roles language plpgsql security definer set search_path='' as $$
declare old_level public.account_roles; result public.account_roles;
begin
  -- Serialize access changes so two owners cannot race the last-owner check.
  perform pg_advisory_xact_lock(73024001);
  if public.current_account_role() is distinct from 'owner' then raise exception 'Only owners can change account levels.'; end if;
  if new_role is null or new_role not in ('owner','manager','coach','parent','athlete') then raise exception 'Choose a valid account level.'; end if;
  select * into old_level from public.account_roles where user_id=target_user;
  if coalesce(old_level.version,0) is distinct from expected_version then raise exception 'This account changed on another device. Refresh before trying again.'; end if;
  if target_user=auth.uid() and new_role is distinct from old_level.role then raise exception 'You cannot change your own Owner access.'; end if;
  if old_level.role='owner' and new_role<>'owner' and (select count(*) from public.account_roles where role='owner')<=1
    then raise exception 'The last Owner cannot be removed.'; end if;
  if not exists(select 1 from auth.users u join public.member_accounts a on a.user_id=u.id where u.id=target_user and u.email_confirmed_at is not null)
    then raise exception 'This person must verify their email and complete adult account setup first.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_user::text,0));
  if new_role='athlete' and ((select count(*) from public.player_profiles where owner_id=target_user)>1 or exists(select 1 from public.player_profiles where owner_id=target_user and age_group<>'18+'))
    then raise exception 'Athlete access requires one adult profile at most. Keep Parent access while family profiles exist.'; end if;
  if old_level.role=new_role then return old_level; end if;
  if new_role in ('parent','athlete') then update public.member_accounts set account_type=case new_role when 'parent' then 'parent' else 'adult' end where user_id=target_user; end if;
  insert into public.account_roles(user_id,role) values(target_user,new_role)
    on conflict (user_id) do update set role=excluded.role returning * into result;
  return result;
end;
$$;
revoke all on function public.assign_account_role(uuid,text,integer) from public, anon;
grant execute on function public.assign_account_role(uuid,text,integer) to authenticated;

-- Replace broad coach permissions with role-aware content permissions.
drop policy "Visitors read published training only" on public.training_resources;
create policy "Staff read permitted training" on public.training_resources for select to authenticated using (status='published' or public.can_edit_training(created_by));
drop policy "Approved coaches create training" on public.training_resources;
create policy "Staff create training" on public.training_resources for insert to authenticated with check (created_by=auth.uid() and public.current_account_role() in ('owner','manager','coach'));
drop policy "Approved coaches edit training" on public.training_resources;
create policy "Staff edit permitted training" on public.training_resources for update to authenticated using(public.can_edit_training(created_by)) with check(public.can_edit_training(created_by));
drop policy "Approved coaches remove training" on public.training_resources;
create policy "Staff remove permitted training" on public.training_resources for delete to authenticated using(public.can_edit_training(created_by));
drop policy "Published training media can be signed for reading" on storage.objects;
create policy "Members read permitted media" on storage.objects for select to authenticated using(bucket_id='training-media' and (
  exists(select 1 from public.training_resources r where r.asset_path=name and (r.status='published' or public.can_edit_training(r.created_by)))
  or public.current_account_role() in ('owner','manager')
  or (public.current_account_role()='coach' and (storage.foldername(name))[1]=auth.uid()::text)
));
drop policy "Approved coaches upload to their own folder" on storage.objects;
create policy "Staff upload to own folder" on storage.objects for insert to authenticated with check(bucket_id='training-media' and (storage.foldername(name))[1]=auth.uid()::text and public.current_account_role() in ('owner','manager','coach'));
drop policy "Approved coaches remove training media" on storage.objects;
create policy "Staff delete permitted media" on storage.objects for delete to authenticated using(bucket_id='training-media' and (
  public.current_account_role() in ('owner','manager') or (public.current_account_role()='coach' and (storage.foldername(name))[1]=auth.uid()::text)
));
-- Private player policies deliberately remain owner-of-profile only for ALL roles.
notify pgrst,'reload schema';

-- SOURCE 004-family-athletes.sql SHA256 a72bf8a70f981cbd1d54cb903e1d7f8baa852150088f139443d883135b8204e8
-- Add family-linked athletes, parent permissions and reviewed practice history.
-- Existing enrollment gates remain closed. Apply once after 003.
alter table public.profile_settings add column child_self_access_enabled boolean not null default false;

create table public.family_athlete_controls (
  profile_id uuid primary key references public.player_profiles(id) on delete cascade,
  self_recording_allowed boolean not null default false,
  version integer not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.family_athlete_links (
  profile_id uuid primary key references public.player_profiles(id) on delete cascade,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index one_family_profile_per_athlete on public.family_athlete_links(athlete_user_id) where revoked_at is null;
create table public.family_athlete_invites (
  token_hash text primary key,
  profile_id uuid not null references public.player_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 hour',
  consumed_at timestamptz,
  revoked_at timestamptz
);
create index family_invites_profile on public.family_athlete_invites(profile_id);
-- These reviews require a trusted, qualified consent process, not a checkbox.
create table public.guardian_access_reviews (
  profile_id uuid primary key references public.player_profiles(id) on delete cascade,
  verified_at timestamptz not null,
  verification_reference text not null check(length(btrim(verification_reference))>0)
);
-- Retain the guardian-managed restriction if a minor's link/profile is removed.
create table public.guardian_managed_athletes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- A parent editing an age band cannot silently remove guardian restrictions.
create table public.family_minor_profiles (
 profile_id uuid primary key references public.player_profiles(id) on delete cascade,
 created_at timestamptz not null default now()
);
insert into public.family_minor_profiles(profile_id) select id from public.player_profiles where age_group<>'18+';
create function public.mark_guardian_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.age_group<>'18+' then insert into public.family_minor_profiles(profile_id) values(new.id) on conflict do nothing; end if;
 return new;
end;
$$;
revoke all on function public.mark_guardian_profile() from public,anon,authenticated;
create trigger remember_minor_profile after insert or update of age_group on public.player_profiles for each row execute function public.mark_guardian_profile();
create table public.practice_catalog (
  id text primary key,
  title text not null,
  minutes integer not null check(minutes between 1 and 20),
  ages text[] not null,
  positions text[] not null,
  levels text[] not null
);
create table public.athlete_workouts (
  id uuid primary key,
  profile_id uuid not null references public.player_profiles(id) on delete cascade,
  reported_by uuid references auth.users(id) on delete set null,
  drill_ids text[] not null,
  titles text[] not null,
  minutes integer not null check(minutes between 1 and 60),
  status text not null check(status in ('pending_parent','approved','needs_repeat','self_reported')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  version integer not null default 1
);
create index athlete_workouts_profile on public.athlete_workouts(profile_id,created_at desc);

create function public.child_access_ready(target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)) or (s.under18_enabled and s.child_self_access_enabled and exists(select 1 from public.guardian_access_reviews g where g.profile_id=p.id)),false)
 from public.player_profiles p cross join public.profile_settings s where p.id=target_profile;
$$;
create function public.can_view_athlete(target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_profiles p where p.id=target_profile and (p.owner_id=auth.uid() or (
   public.child_access_ready(p.id) and exists(select 1 from public.family_athlete_links l where l.profile_id=p.id and l.athlete_user_id=auth.uid() and l.revoked_at is null))));
$$;
revoke all on function public.child_access_ready(uuid),public.can_view_athlete(uuid) from public,anon;
revoke all on function public.child_access_ready(uuid) from authenticated;
grant execute on function public.can_view_athlete(uuid) to authenticated;
drop policy "Owners read private profiles" on public.player_profiles;
create policy "Owners and linked athletes read their profile" on public.player_profiles for select to authenticated using(public.can_view_athlete(id));

alter table public.family_athlete_controls enable row level security;
alter table public.family_athlete_links enable row level security;
alter table public.family_athlete_invites enable row level security;
alter table public.guardian_access_reviews enable row level security;
alter table public.guardian_managed_athletes enable row level security;
alter table public.family_minor_profiles enable row level security;
alter table public.practice_catalog enable row level security;
alter table public.athlete_workouts enable row level security;
revoke all on public.family_athlete_controls,public.family_athlete_links,public.family_athlete_invites,public.guardian_access_reviews,public.guardian_managed_athletes,public.family_minor_profiles,public.practice_catalog,public.athlete_workouts from anon,authenticated;
grant select on public.family_athlete_controls,public.family_athlete_links,public.athlete_workouts to authenticated;
grant select on public.practice_catalog to anon,authenticated;
create policy "Read visible athlete controls" on public.family_athlete_controls for select to authenticated using(public.can_view_athlete(profile_id));
create policy "Read own family connection" on public.family_athlete_links for select to authenticated using(public.can_view_athlete(profile_id));
create policy "Read private workout history" on public.athlete_workouts for select to authenticated using(public.can_view_athlete(profile_id));
create policy "Read illustrative practice catalog" on public.practice_catalog for select to anon,authenticated using(true);

create function public.set_athlete_permission(target_profile uuid,allowed boolean,expected_version integer)
returns public.family_athlete_controls language plpgsql security definer set search_path='' as $$
declare old_row public.family_athlete_controls; result public.family_athlete_controls;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not exists(select 1 from public.player_profiles p join public.member_accounts a on a.user_id=p.owner_id where p.id=target_profile and p.owner_id=auth.uid() and a.account_type='parent') then raise exception 'Only this athlete’s parent account can change permission.'; end if;
 select * into old_row from public.family_athlete_controls where profile_id=target_profile;
 if coalesce(old_row.version,0) is distinct from expected_version then raise exception 'Permission changed on another device. Refresh before retrying.'; end if;
 if allowed is null then raise exception 'Choose a permission.'; end if;
 insert into public.family_athlete_controls(profile_id,self_recording_allowed,updated_by) values(target_profile,allowed,auth.uid())
 on conflict(profile_id) do update set self_recording_allowed=excluded.self_recording_allowed,version=family_athlete_controls.version+1,updated_by=auth.uid(),updated_at=now() returning * into result;
 if not allowed then update public.family_athlete_invites set revoked_at=now() where profile_id=target_profile and consumed_at is null and revoked_at is null; end if;
 return result;
end;
$$;
create function public.create_athlete_invite(target_profile uuid) returns text language plpgsql security definer set search_path='' as $$
declare code text;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not exists(select 1 from public.player_profiles p join public.member_accounts a on a.user_id=p.owner_id join public.family_athlete_controls c on c.profile_id=p.id where p.id=target_profile and p.owner_id=auth.uid() and a.account_type='parent' and c.self_recording_allowed) then raise exception 'A parent must allow self-recording first.'; end if;
 if not coalesce(public.child_access_ready(target_profile),false) then raise exception 'Child access requires completed consent review and enrollment setup.'; end if;
 if exists(select 1 from public.family_athlete_links where profile_id=target_profile and revoked_at is null) then raise exception 'Remove the existing athlete connection before inviting another.'; end if;
 update public.family_athlete_invites set revoked_at=now() where profile_id=target_profile and consumed_at is null and revoked_at is null;
 code:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.family_athlete_invites(token_hash,profile_id) values(encode(sha256(convert_to(code,'UTF8')),'hex'),target_profile);
 return code;
end;
$$;
create function public.accept_athlete_invite(access_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.family_athlete_invites; p public.player_profiles; current_level text;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email before connecting an athlete.'; end if;
 if access_code is null or access_code !~ '^[0-9a-f]{64}$' then raise exception 'This access code is unavailable or expired.'; end if;
 select * into invitation from public.family_athlete_invites where token_hash=encode(sha256(convert_to(access_code,'UTF8')),'hex');
 if not found then raise exception 'This access code is unavailable or expired.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(invitation.profile_id::text,4));
 -- Serialize claims across different families for the same athlete identity.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into invitation from public.family_athlete_invites where token_hash=invitation.token_hash for update;
 if invitation.consumed_at is not null or invitation.revoked_at is not null or invitation.expires_at<=now() then raise exception 'This access code is unavailable or expired.'; end if;
 if exists(select 1 from public.family_athlete_links where profile_id=invitation.profile_id and revoked_at is null) then raise exception 'This profile already has an athlete connection.'; end if;
 select * into strict p from public.player_profiles where id=invitation.profile_id;
 current_level:=public.current_account_role();
 if p.owner_id=auth.uid() or (current_level is not null and current_level<>'athlete') then raise exception 'Use a separate Athlete account for this individual.'; end if;
 if exists(select 1 from public.player_profiles where owner_id=auth.uid()) or exists(select 1 from public.family_athlete_links where athlete_user_id=auth.uid() and revoked_at is null) then raise exception 'This Athlete account already has an individual profile.'; end if;
 if not coalesce(public.child_access_ready(p.id),false) or not exists(select 1 from public.family_athlete_controls where profile_id=p.id and self_recording_allowed) then raise exception 'The parent has not enabled athlete access.'; end if;
 if p.age_group='18+' and not exists(select 1 from public.family_minor_profiles where profile_id=p.id) and not exists(select 1 from public.member_accounts where user_id=auth.uid() and account_type='adult') then raise exception 'Adult athletes must finish their own adult setup first.'; end if;
 if p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles where profile_id=p.id) then
  insert into public.guardian_managed_athletes(user_id) values(auth.uid()) on conflict do nothing;
  delete from public.member_accounts where user_id=auth.uid();
 end if;
 insert into public.account_roles(user_id,role) values(auth.uid(),'athlete') on conflict do nothing;
 insert into public.family_athlete_links(profile_id,athlete_user_id) values(p.id,auth.uid()) on conflict(profile_id) do update set athlete_user_id=excluded.athlete_user_id,linked_at=now(),revoked_at=null;
 update public.family_athlete_invites set consumed_at=now() where token_hash=invitation.token_hash;
 return p.id;
end;
$$;
create function public.remove_athlete_access(target_profile uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not exists(select 1 from public.player_profiles p where p.id=target_profile and (p.owner_id=auth.uid() or (p.age_group='18+' and not exists(select 1 from public.family_minor_profiles where profile_id=p.id) and exists(select 1 from public.family_athlete_links l where l.profile_id=p.id and l.athlete_user_id=auth.uid() and l.revoked_at is null)))) then raise exception 'Only the parent or linked adult athlete can remove this connection.'; end if;
 update public.family_athlete_links set revoked_at=now() where profile_id=target_profile and revoked_at is null;
 update public.family_athlete_invites set revoked_at=now() where profile_id=target_profile and revoked_at is null and consumed_at is null;
end;
$$;

create function public.report_athlete_workout(workout_id uuid,target_profile uuid,requested_drills text[])
returns public.athlete_workouts language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; family boolean; is_parent boolean; titles text[]; total integer; eligible integer; result public.athlete_workouts;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 if (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles where profile_id=p.id)) and not exists(select 1 from public.profile_settings where under18_enabled) then raise exception 'Under-18 workout recording is not open.'; end if;
 family:=exists(select 1 from public.member_accounts where user_id=p.owner_id and account_type='parent');
 is_parent:=family and p.owner_id=auth.uid();
 if p.owner_id<>auth.uid() and not exists(select 1 from public.family_athlete_controls where profile_id=p.id and self_recording_allowed) then raise exception 'The parent has paused independent workout recording.'; end if;
 if requested_drills is null or cardinality(requested_drills) not between 1 and 3 or (select count(distinct d) from unnest(requested_drills) d)<>cardinality(requested_drills) then raise exception 'Choose a valid sample session.'; end if;
 select count(*)::integer,array_agg(c.title order by d.ordinality),sum(c.minutes)::integer into eligible,titles,total
 from unnest(requested_drills) with ordinality d(id,ordinality) join public.practice_catalog c on c.id=d.id
 where p.age_group=any(c.ages) and p.experience=any(c.levels) and (cardinality(c.positions)=0 or p.position=any(c.positions));
 if eligible<>cardinality(requested_drills) then raise exception 'This session does not match the athlete’s age, position or experience.'; end if;
 select * into result from public.athlete_workouts where id=workout_id;
 if found then
  if result.profile_id=target_profile and result.reported_by=auth.uid() and result.drill_ids=requested_drills then return result; end if;
  raise exception 'This workout ID was already used.';
 end if;
 insert into public.athlete_workouts(id,profile_id,reported_by,drill_ids,titles,minutes,status,reviewed_by,reviewed_at)
 values(workout_id,p.id,auth.uid(),requested_drills,titles,total,case when is_parent then 'approved' when family then 'pending_parent' else 'self_reported' end,case when is_parent then auth.uid() else null end,case when is_parent then now() else null end) returning * into result;
 return result;
end;
$$;
create function public.review_athlete_workout(workout_id uuid,decision text,expected_version integer)
returns public.athlete_workouts language plpgsql security definer set search_path='' as $$
declare result public.athlete_workouts;
begin
 if decision not in ('approved','needs_repeat') or decision is null then raise exception 'Choose a review decision.'; end if;
 select w.* into result from public.athlete_workouts w join public.player_profiles p on p.id=w.profile_id join public.member_accounts a on a.user_id=p.owner_id where w.id=workout_id and p.owner_id=auth.uid() and a.account_type='parent' for update of w;
 if not found then raise exception 'Only this athlete’s parent can review the workout.'; end if;
 if result.version is distinct from expected_version or result.status<>'pending_parent' then raise exception 'This workout was already reviewed or changed. Refresh the history.'; end if;
 update public.athlete_workouts set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),version=version+1 where id=workout_id returning * into result;
 return result;
end;
$$;
create function public.family_profile_state(target_profile uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; family boolean; is_parent boolean; allowed boolean; can_record boolean; history jsonb; control_version integer;
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 family:=exists(select 1 from public.member_accounts where user_id=p.owner_id and account_type='parent');
 is_parent:=family and p.owner_id=auth.uid();
 select self_recording_allowed,version into allowed,control_version from public.family_athlete_controls where profile_id=p.id;
 can_record:=(p.owner_id=auth.uid() or coalesce(allowed,false)) and ((p.age_group='18+' and not exists(select 1 from public.family_minor_profiles where profile_id=p.id)) or exists(select 1 from public.profile_settings where under18_enabled));
 select coalesce(jsonb_agg(to_jsonb(w) order by w.created_at desc),'[]'::jsonb) into history from (select * from public.athlete_workouts where profile_id=p.id order by created_at desc limit 50) w;
 return jsonb_build_object('guardian_managed',exists(select 1 from public.family_minor_profiles where profile_id=p.id),'is_family',family,'is_parent',is_parent,'can_record',can_record,'self_recording_allowed',coalesce(allowed,false),'permission_version',coalesce(control_version,0),'has_link',exists(select 1 from public.family_athlete_links where profile_id=p.id and revoked_at is null),'child_access_ready',coalesce(public.child_access_ready(p.id),false),'workouts',history);
end;
$$;
create function public.athlete_account_context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('guardian_managed',exists(select 1 from public.guardian_managed_athletes where user_id=auth.uid()),'linked_profile_id',(select profile_id from public.family_athlete_links where athlete_user_id=auth.uid() and revoked_at is null limit 1));
$$;

alter function public.complete_member_account(text,boolean,boolean) rename to complete_member_account_adult_base;
revoke all on function public.complete_member_account_adult_base(text,boolean,boolean) from public,anon,authenticated;
create function public.complete_member_account(kind text,adult_confirmed boolean,privacy_acknowledged boolean)
returns public.member_accounts language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.guardian_managed_athletes where user_id=auth.uid()) then raise exception 'This Athlete account remains parent-managed. An adult must complete the approved age-transition process.'; end if;
 return public.complete_member_account_adult_base(kind,adult_confirmed,privacy_acknowledged);
end;
$$;
create or replace function public.enforce_athlete_profile_limit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
 if exists(select 1 from public.account_roles where user_id=new.owner_id and role='athlete') then
  if exists(select 1 from public.guardian_managed_athletes where user_id=new.owner_id) or exists(select 1 from public.family_athlete_links where athlete_user_id=new.owner_id and revoked_at is null) then raise exception 'This Athlete already belongs to a family profile.'; end if;
  if new.age_group<>'18+' then raise exception 'Individual athlete enrollment currently requires an adult profile.'; end if;
  if exists(select 1 from public.player_profiles where owner_id=new.owner_id and id<>new.id) then raise exception 'Athlete accounts can manage one personal profile.'; end if;
 end if;
 return new;
end;
$$;
revoke all on function public.set_athlete_permission(uuid,boolean,integer),public.create_athlete_invite(uuid),public.accept_athlete_invite(text),public.remove_athlete_access(uuid),public.report_athlete_workout(uuid,uuid,text[]),public.review_athlete_workout(uuid,text,integer),public.family_profile_state(uuid),public.athlete_account_context(),public.complete_member_account(text,boolean,boolean) from public,anon;
grant execute on function public.set_athlete_permission(uuid,boolean,integer),public.create_athlete_invite(uuid),public.accept_athlete_invite(text),public.remove_athlete_access(uuid),public.report_athlete_workout(uuid,uuid,text[]),public.review_athlete_workout(uuid,text,integer),public.family_profile_state(uuid),public.athlete_account_context(),public.complete_member_account(text,boolean,boolean) to authenticated;
insert into public.practice_catalog(id,title,minutes,ages,positions,levels) values
('little-steps','Find your field feet',3,array['5–7']::text[],array[]::text[],array['New to the game','Building fundamentals','Experienced']::text[]),
('shape-game','The shape & signal game',3,array['5–7']::text[],array[]::text[],array['New to the game','Building fundamentals','Experienced']::text[]),
('soft-hands-young','Roll, stop, reset',3,array['5–7']::text[],array[]::text[],array['New to the game','Building fundamentals','Experienced']::text[]),
('walk-the-line','Walk the route',3,array['5–7']::text[],array[]::text[],array['New to the game','Building fundamentals','Experienced']::text[]),
('ready-reset','Ready. Step. Reset.',4,array['8–12','13–17','18+']::text[],array[]::text[],array['New to the game','Building fundamentals','Experienced']::text[]),
('tracking','Track the soft ball',4,array['8–12','13–17','18+']::text[],array[]::text[],array['New to the game','Building fundamentals','Experienced']::text[]),
('field-vision','Find the open space',4,array['8–12','13–17','18+']::text[],array[]::text[],array['New to the game','Building fundamentals','Experienced']::text[]),
('mirror','Mirror the markers',4,array['8–12','13–17','18+']::text[],array[]::text[],array['New to the game','Building fundamentals','Experienced']::text[]),
('qb-reset','Quarterback reset',5,array['13–17','18+']::text[],array['Quarterback']::text[],array['Building fundamentals','Experienced']::text[]),
('receiver-window','See the receiving window',4,array['8–12','13–17','18+']::text[],array['Wide receiver','Defensive back']::text[],array['New to the game','Building fundamentals','Experienced']::text[]);
alter function public.assign_account_role(uuid,text,integer) rename to assign_adult_account_role_base;
revoke all on function public.assign_adult_account_role_base(uuid,text,integer) from public,anon,authenticated;
create function public.assign_account_role(target_user uuid,new_role text,expected_version integer)
returns public.account_roles language plpgsql security definer set search_path='' as $$
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Only owners can change account levels.'; end if;
 if new_role<>'athlete' and (exists(select 1 from public.guardian_managed_athletes where user_id=target_user) or exists(select 1 from public.family_athlete_links where athlete_user_id=target_user and revoked_at is null)) then raise exception 'A family-linked athlete must remain Athlete. Disconnect adult family access before changing roles.'; end if;
 return public.assign_adult_account_role_base(target_user,new_role,expected_version);
end;
$$;
revoke all on function public.assign_account_role(uuid,text,integer) from public,anon;
grant execute on function public.assign_account_role(uuid,text,integer) to authenticated;
notify pgrst,'reload schema';

-- SOURCE 005-content-audiences.sql SHA256 59e5d261049dc29d1775dfffcf2d786b803dfd638858ad66c950f73178313630
-- Apply once after 001–004 to the dedicated Player Development project.
-- Shared uploads default to protected staff review, including existing uploads.
-- Only explicit public samples are free; paid entitlements are not activated.
alter table public.training_resources add column visibility text;
update public.training_resources set visibility='member_only';
alter table public.training_resources alter column visibility set not null;
alter table public.training_resources alter column visibility set default 'member_only';
alter table public.training_resources add constraint training_visibility check(visibility in ('public_sample','member_only'));

drop policy "Visitors read published training" on public.training_resources;
create policy "Visitors read public samples" on public.training_resources for select to anon using(status='published' and visibility='public_sample');
drop policy "Staff read permitted training" on public.training_resources;
create policy "Read public samples or editable protected content" on public.training_resources for select to authenticated using((status='published' and visibility='public_sample') or public.can_edit_training(created_by));

drop policy "Visitors read published training media" on storage.objects;
create policy "Visitors read public sample media" on storage.objects for select to anon using(bucket_id='training-media' and exists(select 1 from public.training_resources r where r.asset_path=name and r.status='published' and r.visibility='public_sample'));
drop policy "Members read permitted media" on storage.objects;
create policy "Staff read permitted protected media" on storage.objects for select to authenticated using(bucket_id='training-media' and (
 exists(select 1 from public.training_resources r where r.asset_path=name and ((r.status='published' and r.visibility='public_sample') or public.can_edit_training(r.created_by)))
 or public.current_account_role() in ('owner','manager')
 or (public.current_account_role()='coach' and (storage.foldername(name))[1]=auth.uid()::text)
));
-- No browser role can purchase or grant itself entitlements. Ordinary signed-in
-- accounts cannot read protected metadata or request signed media URLs.
notify pgrst,'reload schema';

-- SOURCE 006-assigned-training-and-video-review.sql SHA256 b057c3c6ebc5016438e4e441cc4cb80cdb32f75cf999d93ad978e8138803c83e
-- Additive migration after 001–005. No billing, public uploads or junior access.
create table public.member_training_access (
 account_id uuid primary key references public.member_accounts(user_id) on delete cascade,
 resource_ids uuid[] not null default '{}',
 video_review_enabled boolean not null default false,
 review_coach_id uuid references auth.users(id) on delete set null,
 version integer not null default 1,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.member_training_access enable row level security;
revoke all on public.member_training_access from anon,authenticated;
grant select on public.member_training_access to authenticated;
create policy "Read own training access or owner management" on public.member_training_access for select to authenticated using(account_id=auth.uid() or public.current_account_role()='owner');

create function public.set_member_training_access(target_account uuid,resources uuid[],video_enabled boolean,coach uuid,expected_version integer)
returns public.member_training_access language plpgsql security definer set search_path='' as $$
declare result public.member_training_access;
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Only Owners can assign training and review access.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_account::text,6));
 select * into result from public.member_training_access where account_id=target_account;
 if coalesce(result.version,0) is distinct from expected_version then raise exception 'Access changed. Refresh before saving.'; end if;
 if not exists(select 1 from public.member_accounts a join auth.users u on u.id=a.user_id where a.user_id=target_account and u.email_confirmed_at is not null) then raise exception 'A verified adult account is required.'; end if;
 if resources is null or cardinality(resources)>100 or cardinality(resources)<>(select count(distinct x) from unnest(resources) x) or exists(select 1 from unnest(resources) x where not exists(select 1 from public.training_resources r where r.id=x and r.status='published' and r.visibility='member_only')) then raise exception 'Choose published protected training.'; end if;
 if video_enabled is null or (video_enabled and not exists(select 1 from public.account_roles a where a.user_id=coach and a.role in ('owner','manager','coach'))) then raise exception 'Choose an approved review coach.'; end if;
 insert into public.member_training_access(account_id,resource_ids,video_review_enabled,review_coach_id,updated_by)
 values(target_account,resources,video_enabled,case when video_enabled then coach else null end,auth.uid())
 on conflict(account_id) do update set resource_ids=excluded.resource_ids,video_review_enabled=excluded.video_review_enabled,review_coach_id=excluded.review_coach_id,updated_by=auth.uid(),updated_at=now(),version=member_training_access.version+1 returning * into result;
 return result;
end;
$$;
create function public.training_matches_athlete(target_profile uuid,resource uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_profiles p join public.member_training_access a on a.account_id=p.owner_id join public.training_resources r on r.id=any(a.resource_ids)
 where p.id=target_profile and r.id=resource and r.status='published' and r.visibility='member_only'
 and (p.age_group='18+' or exists(select 1 from public.profile_settings where under18_enabled))
 and (r.content->'ages') ? p.age_group and (r.content->'levels') ? p.experience
 and (jsonb_array_length(r.content->'positions')=0 or (r.content->'positions') ? p.position));
$$;
create function public.can_open_assigned_training(resource uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_profiles p where public.can_view_athlete(p.id) and public.training_matches_athlete(p.id,resource));
$$;
revoke all on function public.training_matches_athlete(uuid,uuid),public.can_open_assigned_training(uuid) from public,anon,authenticated;
grant execute on function public.can_open_assigned_training(uuid) to authenticated;
create policy "Members read assigned matching training" on public.training_resources for select to authenticated using(public.can_open_assigned_training(id));
create policy "Members read assigned matching media" on storage.objects for select to authenticated using(bucket_id='training-media' and exists(select 1 from public.training_resources r where r.asset_path=name and public.can_open_assigned_training(r.id)));
create function public.athlete_training_plan(target_profile uuid) returns setof public.training_resources language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.'; end if;
 return query select r.* from public.training_resources r where public.training_matches_athlete(target_profile,r.id) order by r.created_at desc limit 100;
end;
$$;

create table public.athlete_video_reviews (
 id uuid primary key,
 profile_id uuid not null references public.player_profiles(id) on delete cascade,
 account_id uuid not null references public.member_accounts(user_id) on delete cascade,
 submitted_by uuid not null references auth.users(id),
 resource_id uuid references public.training_resources(id) on delete set null,
 drill_title text not null,
 asset_path text not null unique,
 media_type text not null check(media_type in ('video/mp4','video/quicktime','video/webm')),
 byte_size bigint not null check(byte_size between 1 and 41943040),
 duration_seconds numeric not null check(duration_seconds>0 and duration_seconds<=60),
 status text not null default 'uploading' check(status in ('uploading','pending_parent','queued','reviewed')),
 feedback text not null default '' check(length(feedback)<=3000),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 version integer not null default 1
);
create index athlete_video_reviews_profile on public.athlete_video_reviews(profile_id,created_at desc);
alter table public.athlete_video_reviews enable row level security;
revoke all on public.athlete_video_reviews from anon,authenticated;
grant select on public.athlete_video_reviews to authenticated;
create function public.can_submit_athlete_video(target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_profiles p join public.member_training_access a on a.account_id=p.owner_id join public.account_roles c on c.user_id=a.review_coach_id
 where p.id=target_profile and public.can_view_athlete(p.id) and a.video_review_enabled and c.role in ('owner','manager','coach')
 -- Real child media requires a separate reviewed consent/retention process.
 and p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)
 and (p.owner_id=auth.uid() or exists(select 1 from public.family_athlete_controls f where f.profile_id=p.id and f.self_recording_allowed)));
$$;
create function public.can_view_athlete_video(review uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.athlete_video_reviews v where v.id=review and (
 public.can_view_athlete(v.profile_id) or (v.status in ('queued','reviewed') and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a where a.account_id=v.account_id and a.video_review_enabled and a.review_coach_id=auth.uid()))));
$$;
revoke all on function public.can_submit_athlete_video(uuid),public.can_view_athlete_video(uuid) from public,anon;
grant execute on function public.can_submit_athlete_video(uuid),public.can_view_athlete_video(uuid) to authenticated;
create policy "Private family and assigned coach video reads" on public.athlete_video_reviews for select to authenticated using(public.can_view_athlete_video(id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('athlete-review-videos','athlete-review-videos',false,41943040,array['video/mp4','video/quicktime','video/webm']);
create policy "Upload reserved private athlete video" on storage.objects for insert to authenticated with check(bucket_id='athlete-review-videos' and exists(select 1 from public.athlete_video_reviews v where v.asset_path=name and v.submitted_by=auth.uid() and v.status='uploading' and public.can_submit_athlete_video(v.profile_id)));
create policy "Read authorized private athlete video" on storage.objects for select to authenticated using(bucket_id='athlete-review-videos' and exists(select 1 from public.athlete_video_reviews v where v.asset_path=name and public.can_view_athlete_video(v.id)));
create policy "Family removes private athlete video" on storage.objects for delete to authenticated using(bucket_id='athlete-review-videos' and exists(select 1 from public.athlete_video_reviews v where v.asset_path=name and public.can_view_athlete(v.profile_id) and (v.account_id=auth.uid() or v.submitted_by=auth.uid())));

create function public.athlete_video_state(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.'; end if;
 return jsonb_build_object('can_submit',public.can_submit_athlete_video(target_profile),'remaining_slots',greatest(0,5-(select count(*) from public.athlete_video_reviews v where v.account_id=(select owner_id from public.player_profiles where id=target_profile))),'adult_only',exists(select 1 from public.player_profiles p where p.id=target_profile and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id))),'reviews',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from (select * from public.athlete_video_reviews where profile_id=target_profile order by created_at desc limit 50) v),'[]'::jsonb));
end;
$$;
create function public.begin_athlete_video(review_id uuid,target_profile uuid,training_id uuid,media_type text,byte_size bigint,duration_seconds numeric)
returns public.athlete_video_reviews language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; result public.athlete_video_reviews; ext text;
begin
 perform pg_advisory_xact_lock(hashtextextended(review_id::text,7));
 if not public.can_submit_athlete_video(target_profile) or not public.training_matches_athlete(target_profile,training_id) then raise exception 'Video review is unavailable for this athlete or drill.'; end if;
 if media_type not in ('video/mp4','video/quicktime','video/webm') or byte_size not between 1 and 41943040 or duration_seconds<=0 or duration_seconds>60 then raise exception 'Choose a supported video up to 60 seconds and 40 MB.'; end if;
 select * into result from public.athlete_video_reviews where id=review_id;
 if found then
  if result.profile_id=target_profile and result.submitted_by=auth.uid() and result.resource_id=training_id and result.media_type=begin_athlete_video.media_type and result.byte_size=begin_athlete_video.byte_size and result.duration_seconds=begin_athlete_video.duration_seconds then return result; end if;
  raise exception 'This submission ID was already used.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('player-development-video-budget',7));
 if (select count(*) from public.athlete_video_reviews where account_id=(select owner_id from public.player_profiles where id=target_profile))>=5 or (select coalesce(sum(v.byte_size),0) from public.athlete_video_reviews v)+byte_size>314572800 then raise exception 'Video storage is full. Delete an older clip and retry.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 ext:=case media_type when 'video/mp4' then 'mp4' when 'video/quicktime' then 'mov' else 'webm' end;
 insert into public.athlete_video_reviews(id,profile_id,account_id,submitted_by,resource_id,drill_title,asset_path,media_type,byte_size,duration_seconds)
 select review_id,p.id,p.owner_id,auth.uid(),r.id,r.content->>'title',p.owner_id::text||'/'||p.id::text||'/'||review_id::text||'.'||ext,media_type,byte_size,duration_seconds from public.training_resources r where r.id=training_id returning * into result;
 return result;
end;
$$;
create function public.finish_athlete_video(review_id uuid) returns public.athlete_video_reviews language plpgsql security definer set search_path='' as $$
declare v public.athlete_video_reviews;
begin
 select * into v from public.athlete_video_reviews where id=review_id and submitted_by=auth.uid() for update;
 if not found or not public.can_submit_athlete_video(v.profile_id) or not public.training_matches_athlete(v.profile_id,v.resource_id) then raise exception 'Video permission is unavailable. Nothing was sent for review.'; end if;
 if v.status<>'uploading' then return v; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='athlete-review-videos' and o.name=v.asset_path and (o.metadata->>'size')::bigint=v.byte_size and o.metadata->>'mimetype'=v.media_type) then raise exception 'The complete upload could not be confirmed. Retry the same video.'; end if;
 update public.athlete_video_reviews set status=case when v.submitted_by<>v.account_id and exists(select 1 from public.member_accounts a where a.user_id=v.account_id and a.account_type='parent') then 'pending_parent' else 'queued' end,version=version+1 where id=v.id returning * into v;
 return v;
end;
$$;
create function public.approve_athlete_video(review_id uuid,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.athlete_video_reviews v set status='queued',version=version+1 where v.id=review_id and v.account_id=auth.uid() and public.can_view_athlete(v.profile_id) and v.status='pending_parent' and v.version=expected_version;
 if not found then raise exception 'Video approval changed. Refresh before retrying.'; end if;
end;
$$;
create function public.save_athlete_video_feedback(review_id uuid,feedback_text text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if feedback_text is null or length(btrim(feedback_text)) not between 1 and 3000 then raise exception 'Enter coaching feedback, up to 3000 characters.'; end if;
 update public.athlete_video_reviews v set feedback=btrim(feedback_text),status='reviewed',reviewed_by=auth.uid(),reviewed_at=now(),version=version+1
 where v.id=review_id and v.status in ('queued','reviewed') and v.version=expected_version and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a where a.account_id=v.account_id and a.video_review_enabled and a.review_coach_id=auth.uid());
 if not found then raise exception 'Review access or version changed. Refresh before retrying.'; end if;
end;
$$;
create function public.delete_athlete_video(review_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v public.athlete_video_reviews;
begin
 select * into v from public.athlete_video_reviews where id=review_id and public.can_view_athlete(profile_id) and (account_id=auth.uid() or submitted_by=auth.uid()) for update;
 if not found then raise exception 'This video is unavailable.'; end if;
 if exists(select 1 from storage.objects where bucket_id='athlete-review-videos' and name=v.asset_path) then raise exception 'Remove the stored video before deleting its record.'; end if;
 delete from public.athlete_video_reviews where id=v.id;
end;
$$;
revoke all on function public.set_member_training_access(uuid,uuid[],boolean,uuid,integer),public.athlete_training_plan(uuid),public.athlete_video_state(uuid),public.begin_athlete_video(uuid,uuid,uuid,text,bigint,numeric),public.finish_athlete_video(uuid),public.approve_athlete_video(uuid,integer),public.save_athlete_video_feedback(uuid,text,integer),public.delete_athlete_video(uuid) from public,anon;
grant execute on function public.set_member_training_access(uuid,uuid[],boolean,uuid,integer),public.athlete_training_plan(uuid),public.athlete_video_state(uuid),public.begin_athlete_video(uuid,uuid,uuid,text,bigint,numeric),public.finish_athlete_video(uuid),public.approve_athlete_video(uuid,integer),public.save_athlete_video_feedback(uuid,text,integer),public.delete_athlete_video(uuid) to authenticated;
create or replace function public.report_athlete_workout(workout_id uuid,target_profile uuid,requested_drills text[])
returns public.athlete_workouts language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; family boolean; is_parent boolean; titles text[]; total integer; eligible integer; result public.athlete_workouts;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 if (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles where profile_id=p.id)) and not exists(select 1 from public.profile_settings where under18_enabled) then raise exception 'Under-18 workout recording is not open.'; end if;
 family:=exists(select 1 from public.member_accounts where user_id=p.owner_id and account_type='parent');
 is_parent:=family and p.owner_id=auth.uid();
 if p.owner_id<>auth.uid() and not exists(select 1 from public.family_athlete_controls where profile_id=p.id and self_recording_allowed) then raise exception 'The parent has paused independent workout recording.'; end if;
 if requested_drills is null or cardinality(requested_drills) not between 1 and 3 or (select count(distinct d) from unnest(requested_drills) d)<>cardinality(requested_drills) then raise exception 'Choose a valid assigned session.'; end if;
 select count(*)::integer,array_agg(r.content->>'title' order by d.ordinality),sum((r.content->>'minutes')::integer)::integer into eligible,titles,total
 from unnest(requested_drills) with ordinality d(id,ordinality) join public.training_resources r on r.id::text=d.id
 where public.training_matches_athlete(target_profile,r.id);
 if eligible<>cardinality(requested_drills) then raise exception 'This session does not match the athlete’s age, position or experience.'; end if;
 select * into result from public.athlete_workouts where id=workout_id;
 if found then
  if result.profile_id=target_profile and result.reported_by=auth.uid() and result.drill_ids=requested_drills then return result; end if;
  raise exception 'This workout ID was already used.';
 end if;
 insert into public.athlete_workouts(id,profile_id,reported_by,drill_ids,titles,minutes,status,reviewed_by,reviewed_at)
 values(workout_id,p.id,auth.uid(),requested_drills,titles,total,case when is_parent then 'approved' when family then 'pending_parent' else 'self_reported' end,case when is_parent then auth.uid() else null end,case when is_parent then now() else null end) returning * into result;
 return result;
end;
$$;

-- Storage objects must be removed through Storage before profile-data deletion.
-- Otherwise cascading metadata deletion would strand private objects in the bucket.
create function public.require_video_cleanup_before_profile_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.athlete_video_reviews v where v.profile_id=old.id) then raise exception 'Delete this athlete’s video reviews before removing their profile or member data.'; end if;
 return old;
end;
$$;
revoke all on function public.require_video_cleanup_before_profile_delete() from public,anon,authenticated;
create trigger athlete_video_cleanup_guard before delete on public.player_profiles for each row execute function public.require_video_cleanup_before_profile_delete();

notify pgrst,'reload schema';

-- SOURCE 007-training-assignment-cleanup.sql SHA256 1ebaf9101052044f9548d0dfb07d7d9c334ff380079d7e5e3a66f2fbafb0e733
-- Apply once after 006. Keep manual access editable when content is withdrawn.
create function public.prune_withdrawn_training_assignments() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.status='published' and new.visibility='member_only' then return new; end if;
 end if;
 update public.member_training_access a set resource_ids=array_remove(a.resource_ids,old.id),version=a.version+1,updated_at=now(),updated_by=auth.uid() where old.id=any(a.resource_ids);
 if TG_OP='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function public.prune_withdrawn_training_assignments() from public,anon,authenticated;
create trigger withdrawn_training_access_cleanup after delete or update of status,visibility on public.training_resources for each row execute function public.prune_withdrawn_training_assignments();
-- Remove pre-existing obsolete references, without adding or exposing any content.
update public.member_training_access a set resource_ids=array(select entry.resource_id from unnest(a.resource_ids) as entry(resource_id) where exists(select 1 from public.training_resources r where r.id=entry.resource_id and r.status='published' and r.visibility='member_only')),version=a.version+1,updated_at=now()
where exists(select 1 from unnest(a.resource_ids) as entry(resource_id) where not exists(select 1 from public.training_resources r where r.id=entry.resource_id and r.status='published' and r.visibility='member_only'));
notify pgrst,'reload schema';

-- SOURCE 008-workout-builder.sql SHA256 9d515e33b721cf117eaabaf247f9fc8e5ca54e5a6afac4dbcff3fe8c38b91448
-- Apply once after 007. Private staff templates and one current workout per account.
-- Existing loose-drill permissions, reviews, billing and junior gates are unchanged.
create table public.training_workouts (
 id uuid primary key,
 title text not null check(length(btrim(title)) between 1 and 90),
 summary text not null default '' check(length(summary)<=2000),
 resource_ids uuid[] not null check(cardinality(resource_ids) between 1 and 12),
 created_by uuid references auth.users(id) on delete set null,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.training_workouts enable row level security;
revoke all on public.training_workouts from public,anon,authenticated;
grant select on public.training_workouts to authenticated;
create policy "Staff read managed workout templates" on public.training_workouts for select to authenticated
 using(public.current_account_role() in ('owner','manager') or (public.current_account_role()='coach' and created_by=auth.uid()));

create table public.member_workout_assignments (
 account_id uuid primary key references public.member_accounts(user_id) on delete cascade,
 workout_id uuid references public.training_workouts(id) on delete set null,
 workout_title text not null default '',
 summary text not null default '',
 resource_ids uuid[] not null default '{}',
 workout_version integer not null default 0,
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.member_workout_assignments enable row level security;
revoke all on public.member_workout_assignments from public,anon,authenticated;
grant select on public.member_workout_assignments to authenticated;
create policy "Own workout assignment or Owner management" on public.member_workout_assignments for select to authenticated
 using(account_id=auth.uid() or public.current_account_role()='owner');
alter table public.athlete_workouts add column training_workout_id uuid references public.training_workouts(id) on delete set null,
 add column workout_title text,
 add column workout_version integer;

create function public.valid_workout_resources(resources uuid[]) returns boolean
language sql stable security definer set search_path='' as $$
 select resources is not null and cardinality(resources) between 1 and 12
 and cardinality(resources)=(select count(distinct x) from unnest(resources) x)
 and not exists(select 1 from unnest(resources) x where not exists(select 1 from public.training_resources r where r.id=x and r.status='published' and r.visibility='member_only' and (r.content->>'minutes')::numeric=trunc((r.content->>'minutes')::numeric)))
 and (select sum((r.content->>'minutes')::numeric) from public.training_resources r where r.id=any(resources))<=60
 and exists(select 1 from unnest(array['5–7','8–12','13–17','18+']) age,unnest(array['New to the game','Building fundamentals','Experienced']) experience,unnest(array['Explore all positions','Quarterback','Wide receiver','Running back','Offensive line','Defensive line','Linebacker','Defensive back']) position
 where not exists(select 1 from public.training_resources r where r.id=any(resources) and
 (not ((r.content->'ages') ? age) or not ((r.content->'levels') ? experience) or (jsonb_array_length(r.content->'positions')>0 and not ((r.content->'positions') ? position)))));
$$;
create function public.workout_matches_athlete(target_profile uuid,resources uuid[]) returns boolean
language sql stable security definer set search_path='' as $$
 select public.valid_workout_resources(resources) and exists(select 1 from public.player_profiles p where p.id=target_profile
 and ((p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)) or exists(select 1 from public.profile_settings where under18_enabled))
 and not exists(select 1 from public.training_resources r where r.id=any(resources) and
 (not ((r.content->'ages') ? p.age_group) or not ((r.content->'levels') ? p.experience) or (jsonb_array_length(r.content->'positions')>0 and not ((r.content->'positions') ? p.position)))));
$$;
revoke all on function public.valid_workout_resources(uuid[]),public.workout_matches_athlete(uuid,uuid[]) from public,anon,authenticated;

create function public.save_training_workout(workout uuid,title text,summary text,resources uuid[],expected_version integer)
returns public.training_workouts language plpgsql security definer set search_path='' as $$
declare result public.training_workouts;
begin
 if public.current_account_role() not in ('owner','manager','coach') or public.current_account_role() is null then raise exception 'Staff access is required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(workout::text,8));
 select * into result from public.training_workouts where id=workout for update;
 if found and public.current_account_role()='coach' and result.created_by is distinct from auth.uid() then raise exception 'You can only change your own workouts.'; end if;
 if title is null or length(btrim(title)) not between 1 and 90 or summary is null or length(summary)>2000 or not public.valid_workout_resources(resources) then raise exception 'Choose 1–12 published protected drills with a common audience and at most 60 planned minutes.'; end if;
 if coalesce(result.version,0) is distinct from expected_version then
  if result.version=expected_version+1 and result.title=btrim(title) and result.summary=btrim(summary) and result.resource_ids=resources then return result; end if;
  raise exception 'Workout changed. Refresh before saving.';
 end if;
 insert into public.training_workouts(id,title,summary,resource_ids,created_by) values(workout,btrim(title),btrim(summary),resources,auth.uid())
 on conflict(id) do update set title=excluded.title,summary=excluded.summary,resource_ids=excluded.resource_ids,version=training_workouts.version+1,updated_at=now() returning * into result;
 return result;
end;
$$;
create function public.remove_training_workout(workout uuid,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.current_account_role() not in ('owner','manager','coach') or public.current_account_role() is null then raise exception 'Staff access is required.'; end if;
 delete from public.training_workouts w where w.id=workout and w.version=expected_version and (public.current_account_role() in ('owner','manager') or w.created_by=auth.uid());
 if not found then raise exception 'Workout changed or unavailable. Refresh before removing.'; end if;
end;
$$;
create function public.clear_removed_workout_assignments() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.member_workout_assignments set workout_id=null,workout_title='',summary='',resource_ids='{}',workout_version=0,version=version+1,updated_at=now(),updated_by=auth.uid() where workout_id=old.id;
 return old;
end;
$$;
revoke all on function public.clear_removed_workout_assignments() from public,anon,authenticated;
create trigger clear_deleted_workout before delete on public.training_workouts for each row execute function public.clear_removed_workout_assignments();
create function public.workout_assignment_preview(workout uuid,workout_version integer,target_account uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare w public.training_workouts;
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.'; end if;
 select * into w from public.training_workouts where id=workout and version=workout_version;
 if not found then raise exception 'Workout changed. Refresh before assigning.'; end if;
 if not exists(select 1 from public.member_accounts a join auth.users u on u.id=a.user_id where a.user_id=target_account and u.email_confirmed_at is not null) then raise exception 'Choose a verified customer account.'; end if;
 return jsonb_build_object('eligible',exists(select 1 from public.player_profiles p where p.owner_id=target_account and public.workout_matches_athlete(p.id,w.resource_ids)));
end;
$$;
create function public.assign_training_workout(target_account uuid,workout uuid,workout_version integer,expected_version integer)
returns public.member_workout_assignments language plpgsql security definer set search_path='' as $$
declare w public.training_workouts; result public.member_workout_assignments;
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Only Owners can assign workouts.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_account::text,8));
 select * into result from public.member_workout_assignments where account_id=target_account for update;
 if not exists(select 1 from public.member_accounts a join auth.users u on u.id=a.user_id where a.user_id=target_account and u.email_confirmed_at is not null) then raise exception 'Choose a verified customer account.'; end if;
 if workout is null then
  if coalesce(result.version,0) is distinct from expected_version then
   if result.version=expected_version+1 and result.workout_id is null then return result; end if;
   raise exception 'Assignment changed. Reload before saving.';
  end if;
  insert into public.member_workout_assignments(account_id,updated_by) values(target_account,auth.uid())
  on conflict(account_id) do update set workout_id=null,workout_title='',summary='',resource_ids='{}',workout_version=0,version=member_workout_assignments.version+1,updated_at=now(),updated_by=auth.uid() returning * into result;
  return result;
 end if;
 select * into w from public.training_workouts where id=workout and version=workout_version for share;
 if not found then raise exception 'Workout changed. Refresh before assigning.'; end if;
 if not (public.workout_assignment_preview(workout,workout_version,target_account)->>'eligible')::boolean then raise exception 'No eligible athlete matches every drill. Existing access is unchanged.'; end if;
 if coalesce(result.version,0) is distinct from expected_version then
  if result.version=expected_version+1 and result.workout_id=workout and result.workout_version=workout_version and result.resource_ids=w.resource_ids then return result; end if;
  raise exception 'Assignment changed. Reload before saving.';
 end if;
 insert into public.member_workout_assignments(account_id,workout_id,workout_title,summary,resource_ids,workout_version,updated_by)
 values(target_account,w.id,w.title,w.summary,w.resource_ids,w.version,auth.uid())
 on conflict(account_id) do update set workout_id=excluded.workout_id,workout_title=excluded.workout_title,summary=excluded.summary,resource_ids=excluded.resource_ids,workout_version=excluded.workout_version,version=member_workout_assignments.version+1,updated_at=now(),updated_by=auth.uid() returning * into result;
 return result;
end;
$$;
revoke all on function public.save_training_workout(uuid,text,text,uuid[],integer),public.remove_training_workout(uuid,integer),public.workout_assignment_preview(uuid,integer,uuid),public.assign_training_workout(uuid,uuid,integer,integer) from public,anon;
grant execute on function public.save_training_workout(uuid,text,text,uuid[],integer),public.remove_training_workout(uuid,integer),public.workout_assignment_preview(uuid,integer,uuid),public.assign_training_workout(uuid,uuid,integer,integer) to authenticated;

-- Whole-workout access supplements, but never rewrites, existing loose grants.
create or replace function public.training_matches_athlete(target_profile uuid,resource uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_profiles p join public.training_resources r on r.id=resource
 where p.id=target_profile and r.status='published' and r.visibility='member_only'
 and ((p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)) or exists(select 1 from public.profile_settings where under18_enabled))
 and (r.content->'ages') ? p.age_group and (r.content->'levels') ? p.experience and (jsonb_array_length(r.content->'positions')=0 or (r.content->'positions') ? p.position)
 and (exists(select 1 from public.member_training_access a where a.account_id=p.owner_id and r.id=any(a.resource_ids))
 or exists(select 1 from public.member_workout_assignments a where a.account_id=p.owner_id and a.workout_id is not null and r.id=any(a.resource_ids) and public.workout_matches_athlete(p.id,a.resource_ids))));
$$;
create or replace function public.athlete_training_plan(target_profile uuid) returns setof public.training_resources language plpgsql stable security definer set search_path='' as $$
declare assignment public.member_workout_assignments;
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.'; end if;
 select a.* into assignment from public.member_workout_assignments a join public.player_profiles p on p.owner_id=a.account_id where p.id=target_profile;
 if found and assignment.workout_id is not null and public.workout_matches_athlete(target_profile,assignment.resource_ids) then
  return query select r.* from unnest(assignment.resource_ids) with ordinality d(id,ordinality) join public.training_resources r on r.id=d.id order by d.ordinality;
 else
  -- A nonmatching sibling keeps their previous explicitly granted loose drills.
  return query select r.* from public.training_resources r join public.member_training_access a on r.id=any(a.resource_ids) join public.player_profiles p on p.owner_id=a.account_id where p.id=target_profile and public.training_matches_athlete(p.id,r.id) order by r.created_at desc limit 100;
 end if;
end;
$$;
create or replace function public.family_profile_state(target_profile uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; family boolean; is_parent boolean; allowed boolean; can_record boolean; history jsonb; control_version integer; assignment public.member_workout_assignments; assigned jsonb;
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 family:=exists(select 1 from public.member_accounts where user_id=p.owner_id and account_type='parent');
 is_parent:=family and p.owner_id=auth.uid();
 select self_recording_allowed,version into allowed,control_version from public.family_athlete_controls where profile_id=p.id;
 can_record:=(p.owner_id=auth.uid() or coalesce(allowed,false)) and ((p.age_group='18+' and not exists(select 1 from public.family_minor_profiles where profile_id=p.id)) or exists(select 1 from public.profile_settings where under18_enabled));
 select coalesce(jsonb_agg(to_jsonb(w) order by w.created_at desc),'[]'::jsonb) into history from (select * from public.athlete_workouts where profile_id=p.id order by created_at desc limit 50) w;
 select * into assignment from public.member_workout_assignments where account_id=p.owner_id;
 if found and assignment.workout_id is not null then assigned:=jsonb_build_object('id',assignment.workout_id,'title',assignment.workout_title,'summary',assignment.summary,'resource_ids',assignment.resource_ids,'version',assignment.workout_version,'eligible',public.workout_matches_athlete(p.id,assignment.resource_ids)); end if;
 return jsonb_build_object('guardian_managed',exists(select 1 from public.family_minor_profiles where profile_id=p.id),'is_family',family,'is_parent',is_parent,'can_record',can_record,'self_recording_allowed',coalesce(allowed,false),'permission_version',coalesce(control_version,0),'has_link',exists(select 1 from public.family_athlete_links where profile_id=p.id and revoked_at is null),'child_access_ready',coalesce(public.child_access_ready(p.id),false),'workouts',history,'assigned_workout',assigned);
end;
$$;

create or replace function public.report_athlete_workout(workout_id uuid,target_profile uuid,requested_drills text[])
returns public.athlete_workouts language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; family boolean; is_parent boolean; titles text[]; total integer; eligible integer; result public.athlete_workouts; assignment public.member_workout_assignments; is_assigned boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 if (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles where profile_id=p.id)) and not exists(select 1 from public.profile_settings where under18_enabled) then raise exception 'Under-18 workout recording is not open.'; end if;
 family:=exists(select 1 from public.member_accounts where user_id=p.owner_id and account_type='parent');is_parent:=family and p.owner_id=auth.uid();
 if p.owner_id<>auth.uid() and not exists(select 1 from public.family_athlete_controls where profile_id=p.id and self_recording_allowed) then raise exception 'The parent has paused independent workout recording.'; end if;
 select * into result from public.athlete_workouts where id=workout_id;
 if found then
  if result.profile_id=target_profile and result.reported_by=auth.uid() and result.drill_ids=requested_drills then return result; end if;
  raise exception 'This workout ID was already used.';
 end if;
 select * into assignment from public.member_workout_assignments where account_id=p.owner_id;
 is_assigned:=found and assignment.workout_id is not null and public.workout_matches_athlete(p.id,assignment.resource_ids);
 if requested_drills is null or cardinality(requested_drills) not between 1 and 12 or (select count(distinct d) from unnest(requested_drills) d)<>cardinality(requested_drills)
 or (is_assigned and requested_drills is distinct from assignment.resource_ids::text[]) or (not is_assigned and cardinality(requested_drills)>3) then raise exception 'Complete the current assigned session in its saved order. Refresh before starting again.'; end if;
 select count(*)::integer,array_agg(r.content->>'title' order by d.ordinality),sum((r.content->>'minutes')::integer)::integer into eligible,titles,total from unnest(requested_drills) with ordinality d(id,ordinality) join public.training_resources r on r.id::text=d.id where public.training_matches_athlete(target_profile,r.id);
 if eligible<>cardinality(requested_drills) or total not between 1 and 60 then raise exception 'This session does not match the athlete’s current training access.'; end if;
 insert into public.athlete_workouts(id,profile_id,reported_by,drill_ids,titles,minutes,status,reviewed_by,reviewed_at,training_workout_id,workout_title,workout_version)
 values(workout_id,p.id,auth.uid(),requested_drills,titles,total,case when is_parent then 'approved' when family then 'pending_parent' else 'self_reported' end,case when is_parent then auth.uid() else null end,case when is_parent then now() else null end,case when is_assigned then assignment.workout_id end,case when is_assigned then assignment.workout_title end,case when is_assigned then assignment.workout_version end) returning * into result;
 return result;
end;
$$;
-- Bind completion to the version actually opened, even if two templates use identical drills.
create function public.report_saved_workout(workout_id uuid,target_profile uuid,requested_drills text[],expected_workout uuid,expected_workout_version integer)
returns public.athlete_workouts language plpgsql security definer set search_path='' as $$
declare result public.athlete_workouts; assignment public.member_workout_assignments;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into result from public.athlete_workouts where id=workout_id;
 if found then
  if result.profile_id=target_profile and result.reported_by=auth.uid() and result.drill_ids=requested_drills and result.training_workout_id=expected_workout and result.workout_version=expected_workout_version then return result; end if;
  raise exception 'This workout ID was already used.';
 end if;
 select a.* into assignment from public.member_workout_assignments a join public.player_profiles p on p.owner_id=a.account_id where p.id=target_profile for share of a;
 if not found or assignment.workout_id is distinct from expected_workout or assignment.workout_version is distinct from expected_workout_version or assignment.resource_ids::text[] is distinct from requested_drills then raise exception 'The assigned workout changed. Refresh before starting again.'; end if;
 return public.report_athlete_workout(workout_id,target_profile,requested_drills);
end;
$$;
revoke all on function public.report_saved_workout(uuid,uuid,text[],uuid,integer) from public,anon;
grant execute on function public.report_saved_workout(uuid,uuid,text[],uuid,integer) to authenticated;
notify pgrst,'reload schema';

-- SOURCE 009-content-review-and-practice-resume.sql SHA256 11886dfbf5d03631c038571d9cd3ef07a21687b854af9088ce007761fd6ed0a3
-- Apply once after 008. Private content approval and account-scoped unfinished practice.
-- Existing published resources are withdrawn for explicit staff review, never auto-approved.
alter table public.training_resources
 add column review_stage text not null default 'draft' check(review_stage in ('draft','pending','changes_requested','approved')),
 add column review_notes text not null default '' check(length(review_notes)<=2000),
 add column reviewed_by uuid references auth.users(id) on delete set null,
 add column reviewed_at timestamptz;
update public.training_resources set review_stage='pending',status='draft' where status='published';
alter table public.training_resources add constraint training_publication_requires_approval check((status='published')=(review_stage='approved'));
alter table public.training_resources drop constraint training_resources_asset_path_check;
alter table public.training_resources add constraint training_resources_asset_path_check check(asset_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|mov|webm|png|jpg|webp|pdf|txt)$');
alter table public.training_resources drop constraint training_resources_asset_type_check;
alter table public.training_resources add constraint training_resources_asset_type_check check(asset_type in ('video/mp4','video/quicktime','video/webm','image/png','image/jpeg','image/webp','application/pdf','text/plain'));
update storage.buckets set file_size_limit=41943040,allowed_mime_types=array['video/mp4','video/quicktime','video/webm','image/png','image/jpeg','image/webp','application/pdf','text/plain'] where id='training-media';

-- Direct API requests cannot set approval, reviewer, version or publication status.
revoke insert,update on public.training_resources from authenticated;
grant insert(id,content,asset_path,asset_type,asset_name,visibility) on public.training_resources to authenticated;
grant update(content,asset_path,asset_type,asset_name,visibility) on public.training_resources to authenticated;
create function public.reset_training_review() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' or (new.content,new.asset_path,new.asset_type,new.asset_name,new.visibility) is distinct from (old.content,old.asset_path,old.asset_type,old.asset_name,old.visibility) then
  new.review_stage:='draft';new.status:='draft';new.review_notes:='';new.reviewed_by:=null;new.reviewed_at:=null;
 end if;
 return new;
end;
$$;
revoke all on function public.reset_training_review() from public,anon,authenticated;
create trigger training_review_reset before insert or update on public.training_resources for each row execute function public.reset_training_review();
create table public.training_review_audit (
 id bigint generated always as identity primary key,
 resource_id uuid not null references public.training_resources(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 stage text not null,notes text not null,
 resource_version integer not null,created_at timestamptz not null default now()
);
alter table public.training_review_audit enable row level security;
revoke all on public.training_review_audit from public,anon,authenticated;
grant select on public.training_review_audit to authenticated;
create policy "Staff read review history of managed content" on public.training_review_audit for select to authenticated using(exists(select 1 from public.training_resources r where r.id=resource_id and public.can_edit_training(r.created_by)));
create function public.audit_training_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.review_stage is distinct from old.review_stage then
  insert into public.training_review_audit(resource_id,actor_id,stage,notes,resource_version) values(new.id,auth.uid(),new.review_stage,new.review_notes,new.version);
 end if;
 return new;
end;
$$;
revoke all on function public.audit_training_review() from public,anon,authenticated;
create trigger training_review_history after insert or update on public.training_resources for each row execute function public.audit_training_review();
create function public.review_training_resource(resource uuid,decision text,note text,expected_version integer)
returns public.training_resources language plpgsql security definer set search_path='' as $$
declare r public.training_resources; target text; reviewer boolean;
begin
 select * into r from public.training_resources where id=resource for update;
 if not found or not public.can_edit_training(r.created_by) then raise exception 'Staff access to this resource is required.';end if;
 if note is null or length(note)>2000 then raise exception 'Keep the review note within 2000 characters.';end if;
 reviewer:=coalesce(public.current_account_role() in ('owner','manager'),false);
 target:=case decision when 'submit' then 'pending' when 'approve' then 'approved' when 'request_changes' then 'changes_requested' end;
 if target is null or (decision<>'submit' and not reviewer) then raise exception 'Owner or Manager approval is required.';end if;
 if decision='request_changes' and length(btrim(note))=0 then raise exception 'Explain what needs to change.';end if;
 if r.version is distinct from expected_version then
  if r.version=expected_version+1 and r.review_stage=target and r.review_notes=btrim(note) and (decision='submit' or r.reviewed_by=auth.uid()) then return r;end if;
  raise exception 'This resource changed. Refresh before reviewing.';
 end if;
 if (decision='submit' and r.review_stage not in ('draft','changes_requested')) or (decision<>'submit' and r.review_stage<>'pending') then raise exception 'This review stage has already changed. Refresh the queue.';end if;
 update public.training_resources set review_stage=target,status=case when target='approved' then 'published' else 'draft' end,
 review_notes=btrim(note),reviewed_by=case when decision='submit' then null else auth.uid() end,reviewed_at=case when decision='submit' then null else now() end where id=resource returning * into r;
 return r;
end;
$$;
revoke all on function public.review_training_resource(uuid,text,text,integer) from public,anon;
grant execute on function public.review_training_resource(uuid,text,text,integer) to authenticated;

-- Internal review notes must never ride along with public/member drill rows.
revoke select on public.training_resources from anon,authenticated;
grant select(id,created_by,created_at,updated_at,version,status,content,asset_path,asset_type,asset_name,visibility,review_stage) on public.training_resources to anon,authenticated;
create function public.staff_training_resources() returns setof public.training_resources language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(public.current_account_role() in ('owner','manager','coach'),false) is false then raise exception 'Staff access is required.';end if;
 return query select r.* from public.training_resources r where public.can_edit_training(r.created_by) order by r.created_at desc;
end;
$$;
revoke all on function public.staff_training_resources() from public,anon;
grant execute on function public.staff_training_resources() to authenticated;
alter function public.athlete_training_plan(uuid) rename to athlete_training_plan_internal_v8;
revoke all on function public.athlete_training_plan_internal_v8(uuid) from public,anon,authenticated;
create function public.athlete_training_plan(target_profile uuid) returns setof public.training_resources language plpgsql stable security definer set search_path='' as $$
declare r public.training_resources;
begin
 for r in select * from public.athlete_training_plan_internal_v8(target_profile) loop
  r.review_notes:='';r.reviewed_by:=null;r.reviewed_at:=null;
  return next r;
 end loop;
end;
$$;
revoke all on function public.athlete_training_plan(uuid) from public,anon;
grant execute on function public.athlete_training_plan(uuid) to authenticated;

create table public.practice_resumes (
 user_id uuid not null references auth.users(id) on delete cascade,
 profile_id uuid not null references public.player_profiles(id) on delete cascade,
 session_id uuid not null,resource_ids uuid[] not null,resource_versions integer[] not null,
 current_index integer not null,workout_id uuid,workout_version integer,assignment_version integer not null default 0,
 permission_version integer not null,version integer not null default 1,
 updated_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',
 primary key(user_id,profile_id),
 check(cardinality(resource_ids) between 1 and 12),check(cardinality(resource_versions)=cardinality(resource_ids)),
 check(current_index>=0 and current_index<cardinality(resource_ids))
);
alter table public.practice_resumes enable row level security;
revoke all on public.practice_resumes from public,anon,authenticated;
-- Resume rows contain IDs and current_position only; access goes through checked RPCs.
create function public.practice_resume_valid(r public.practice_resumes) returns boolean language plpgsql stable security definer set search_path='' as $$
declare context jsonb; a public.member_workout_assignments;
begin
 if r.user_id is distinct from auth.uid() or r.expires_at<=now() or not public.can_view_athlete(r.profile_id) then return false;end if;
 context:=public.family_profile_state(r.profile_id);
 if not coalesce((context->>'can_record')::boolean,false) or r.permission_version<>coalesce((context->>'permission_version')::integer,0) then return false;end if;
 if exists(select 1 from generate_subscripts(r.resource_ids,1) i where not exists(select 1 from public.training_resources d where d.id=r.resource_ids[i] and d.version=r.resource_versions[i] and d.status='published' and d.review_stage='approved' and public.training_matches_athlete(r.profile_id,d.id))) then return false;end if;
 select x.* into a from public.member_workout_assignments x join public.player_profiles p on p.owner_id=x.account_id where p.id=r.profile_id;
 if a.workout_id is not null then return r.workout_id=a.workout_id and r.workout_version=a.workout_version and r.assignment_version=a.version and r.resource_ids=a.resource_ids;end if;
 return r.workout_id is null and r.assignment_version=coalesce(a.version,0);
end;
$$;
revoke all on function public.practice_resume_valid(public.practice_resumes) from public,anon,authenticated;
create function public.load_practice_resume(target_profile uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.practice_resumes;
begin
 select * into r from public.practice_resumes where user_id=auth.uid() and profile_id=target_profile;
 if not found then return null;end if;
 if not public.practice_resume_valid(r) then delete from public.practice_resumes where user_id=auth.uid() and profile_id=target_profile and version=r.version;return null;end if;
 return to_jsonb(r)-'user_id';
end;
$$;
create function public.save_practice_resume(target_profile uuid,session uuid,resources uuid[],resource_versions integer[],current_position integer,expected_version integer,expected_workout uuid default null,expected_workout_version integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb;r public.practice_resumes;a public.member_workout_assignments;next_row public.practice_resumes;
begin
 if auth.uid() is null or not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 context:=public.family_profile_state(target_profile);
 if not coalesce((context->>'can_record')::boolean,false) then raise exception 'Workout recording is not permitted.';end if;
 if exists(select 1 from public.athlete_workouts where id=session) then raise exception 'This practice was already recorded.';end if;
 if session is null or resources is null or cardinality(resources) not between 1 and 12 or cardinality(resources)<>(select count(distinct x) from unnest(resources) x) or resource_versions is null or cardinality(resource_versions)<>cardinality(resources) or current_position is null or current_position<0 or current_position>=cardinality(resources) then raise exception 'Choose a valid workout current_position.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||target_profile::text,9));
 select * into r from public.practice_resumes where user_id=auth.uid() and profile_id=target_profile for update;
 if found and not public.practice_resume_valid(r) then delete from public.practice_resumes where user_id=auth.uid() and profile_id=target_profile;r:=null;end if;
 select x.* into a from public.member_workout_assignments x join public.player_profiles p on p.owner_id=x.account_id where p.id=target_profile;
 if coalesce(r.version,0)<>expected_version then
  if r.version=expected_version+1 and r.session_id=session and r.resource_ids=resources and r.resource_versions=resource_versions and r.current_index=current_position then return to_jsonb(r)-'user_id';end if;
  raise exception 'Practice changed on another device. Close and reload training.';
 end if;
 if r.session_id is not null and r.session_id<>session then raise exception 'Discard the saved practice before starting another.';end if;
 next_row.user_id:=auth.uid();next_row.profile_id:=target_profile;next_row.session_id:=session;next_row.resource_ids:=resources;next_row.resource_versions:=resource_versions;next_row.current_index:=current_position;
 next_row.workout_id:=expected_workout;next_row.workout_version:=expected_workout_version;next_row.assignment_version:=coalesce(a.version,0);
 next_row.permission_version:=coalesce((context->>'permission_version')::integer,0);next_row.expires_at:=now()+interval '7 days';
 if not public.practice_resume_valid(next_row) or not public.valid_workout_resources(resources) then raise exception 'This workout changed or is no longer available. Reload training.';end if;
 insert into public.practice_resumes(user_id,profile_id,session_id,resource_ids,resource_versions,current_index,workout_id,workout_version,assignment_version,permission_version)
 values(next_row.user_id,target_profile,session,resources,resource_versions,current_position,expected_workout,expected_workout_version,next_row.assignment_version,next_row.permission_version)
 on conflict(user_id,profile_id) do update set current_index=excluded.current_index,resource_ids=excluded.resource_ids,resource_versions=excluded.resource_versions,workout_id=excluded.workout_id,workout_version=excluded.workout_version,assignment_version=excluded.assignment_version,permission_version=excluded.permission_version,version=practice_resumes.version+1,updated_at=now(),expires_at=now()+interval '7 days' returning * into r;
 return to_jsonb(r)-'user_id';
end;
$$;
create function public.discard_practice_resume(target_profile uuid,session uuid,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.practice_resumes where user_id=auth.uid() and profile_id=target_profile and session_id=session and version=expected_version;
 if not found and exists(select 1 from public.practice_resumes where user_id=auth.uid() and profile_id=target_profile) then raise exception 'Practice changed on another device. Reload training.';end if;
end;
$$;
create function public.clear_finished_practice_resume() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.practice_resumes where profile_id=new.profile_id and user_id=new.reported_by and session_id=new.id;
 return new;
end;
$$;
revoke all on function public.clear_finished_practice_resume() from public,anon,authenticated;
create trigger clear_finished_practice after insert on public.athlete_workouts for each row execute function public.clear_finished_practice_resume();
revoke all on function public.load_practice_resume(uuid),public.save_practice_resume(uuid,uuid,uuid[],integer[],integer,integer,uuid,integer),public.discard_practice_resume(uuid,uuid,integer) from public,anon;
grant execute on function public.load_practice_resume(uuid),public.save_practice_resume(uuid,uuid,uuid[],integer[],integer,integer,uuid,integer),public.discard_practice_resume(uuid,uuid,integer) to authenticated;
notify pgrst, 'reload schema';

-- SOURCE 010-account-invitations-and-closure.sql SHA256 1c4173bf3e7f922a04e32a8bbd2cec5972b4d3d3c1a4afdccaea31e0112d92f0
-- Apply once after 009. Private adult invitations and verified customer erasure.
-- No signup, junior, billing, SMTP or existing role settings are opened here.

create table public.account_onboarding_settings (
 singleton boolean primary key default true check(singleton),
 legacy_before timestamptz not null default now()
);
insert into public.account_onboarding_settings default values;
alter table public.account_onboarding_settings enable row level security;
revoke all on public.account_onboarding_settings from public,anon,authenticated;

create table public.account_invitations (
 id uuid primary key,
 email text not null check(email=lower(btrim(email)) and length(email) between 3 and 254),
 intended_role text not null check(intended_role in ('manager','coach','parent','athlete')),
 invited_by uuid references auth.users(id) on delete set null,
 target_user uuid references auth.users(id) on delete cascade,
 state text not null default 'preparing' check(state in ('preparing','sent','failed','accepted','cancelled','expired')),
 delivery_code text not null default '',
 attempts integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,
 version integer not null default 1
);
create unique index one_active_account_invite_per_email on public.account_invitations(email) where state in ('preparing','sent');
alter table public.account_invitations enable row level security;
revoke all on public.account_invitations from public,anon,authenticated;

create table public.account_closures (
 id uuid primary key,
 user_id uuid unique references auth.users(id) on delete set null,
 state text not null check(state in ('cleaning','failed','completed','assistance_requested','assistance_reviewed')),
 reason text not null default '',
 profile_count integer not null default 0,
 video_count integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.account_closures enable row level security;
revoke all on public.account_closures from public,anon,authenticated;

create function public.account_is_closing(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.account_closures where user_id=target and state in ('cleaning','failed'));
$$;
revoke all on function public.account_is_closing(uuid) from public,anon,authenticated;

create function public.account_closure_reason(target uuid) returns text
language sql stable security definer set search_path='' as $$
 select case
 when exists(select 1 from public.account_roles where user_id=target and role='owner') then 'owner_transfer'
 when exists(select 1 from public.account_roles where user_id=target and role in ('manager','coach'))
   or exists(select 1 from public.training_resources where created_by=target)
   or exists(select 1 from public.training_workouts where created_by=target)
   or exists(select 1 from storage.objects where bucket_id='training-media' and split_part(name,'/',1)=target::text) then 'staff_content'
 when exists(select 1 from public.guardian_managed_athletes where user_id=target)
   or exists(select 1 from public.player_profiles p where p.owner_id=target and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)))
   or exists(select 1 from public.family_athlete_links l join public.player_profiles p on p.id=l.profile_id where l.athlete_user_id=target and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id))) then 'guardian_review'
 else '' end;
$$;
revoke all on function public.account_closure_reason(uuid) from public,anon,authenticated;

create function public.account_lifecycle_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); reason text; job public.account_closures;
begin
 if u is null then raise exception 'Sign in first.';end if;
 reason:=public.account_closure_reason(u);
 select * into job from public.account_closures where user_id=u;
 return jsonb_build_object('eligible',reason='','reason',reason,'request_id',job.id,'state',coalesce(job.state,'none'),
  'profile_count',(select count(*) from public.player_profiles where owner_id=u),
  'video_count',(select count(*) from public.athlete_video_reviews where account_id=u or submitted_by=u));
end;
$$;
revoke all on function public.account_lifecycle_state() from public,anon;
grant execute on function public.account_lifecycle_state() to authenticated;

create function public.list_account_invitations() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.';end if;
 return coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from
 (select id,email,intended_role,state,delivery_code,created_at,updated_at,expires_at,version from public.account_invitations order by created_at desc limit 100) i),'[]'::jsonb);
end;
$$;
revoke all on function public.list_account_invitations() from public,anon;
grant execute on function public.list_account_invitations() to authenticated;

-- Only the server can reserve/send an invitation. A stable ID limits repeat sends.
create function public.begin_account_invitation(actor uuid,invitation uuid,target_email text,target_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.account_invitations; normalized text:=lower(btrim(target_email)); verified_user uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(normalized,1010));
 if not exists(select 1 from public.account_roles where user_id=actor and role='owner') then raise exception 'Owner access is required.';end if;
 if normalized is null or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized)>254 or target_role not in ('manager','coach','parent','athlete') then raise exception 'Choose a valid adult email and invitation level.';end if;
 select * into i from public.account_invitations where id=invitation for update;
 if found then
  if i.email<>normalized or i.intended_role<>target_role or i.invited_by<>actor then raise exception 'Invitation ID already used.';end if;
  if i.state<>'failed' or i.updated_at>now()-interval '60 seconds' then return jsonb_build_object('deliver',false,'invitation',to_jsonb(i));end if;
  if i.attempts>=5 then raise exception 'Too many delivery attempts. Ask the Owner to check email configuration.';end if;
  update public.account_invitations set state='preparing',delivery_code='',attempts=attempts+1,updated_at=now(),version=version+1 where id=i.id returning * into i;
 else
  update public.account_invitations set state='expired',version=version+1,updated_at=now() where email=normalized and state in ('preparing','sent') and expires_at<=now();
  if exists(select 1 from public.account_invitations where email=normalized and state in ('preparing','sent')) then raise exception 'An invitation is already pending. Refresh invitations.';end if;
  if (select count(*) from public.account_invitations where invited_by=actor and created_at>now()-interval '1 hour')>=10 then raise exception 'Invitation limit reached. Wait before inviting more people.';end if;
  select id into verified_user from auth.users where lower(email)=normalized and email_confirmed_at is not null;
  if verified_user is not null and (exists(select 1 from public.account_roles where user_id=verified_user) or exists(select 1 from public.member_accounts where user_id=verified_user)) then raise exception 'This account already exists. Use Manage account access.';end if;
  insert into public.account_invitations(id,email,intended_role,invited_by,target_user,state,delivery_code)
   values(invitation,normalized,target_role,actor,verified_user,case when verified_user is null then 'preparing' else 'sent' end,case when verified_user is null then '' else 'existing_account' end) returning * into i;
  if verified_user is not null then return jsonb_build_object('deliver',false,'invitation',to_jsonb(i));end if;
 end if;
 return jsonb_build_object('deliver',true,'invitation',to_jsonb(i));
end;
$$;

create function public.finish_account_invitation(invitation uuid,recipient uuid,result_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.account_invitations;
begin
 select * into strict i from public.account_invitations where id=invitation for update;
 if i.state='accepted' then return jsonb_build_object('id',i.id,'state',i.state,'delivery_code',i.delivery_code);end if;
 if recipient is not null and not exists(select 1 from auth.users where id=recipient and lower(email)=i.email) then raise exception 'Invitation recipient mismatch.';end if;
 if result_code not in ('sent','mail_setup_required','delivery_unconfirmed','account_exists') then raise exception 'Invalid delivery result.';end if;
 update public.account_invitations set target_user=coalesce(recipient,target_user),
  state=case when state='cancelled' then 'cancelled' when result_code='sent' then 'sent' else 'failed' end,
  delivery_code=result_code,updated_at=now(),version=version+1 where id=i.id returning * into i;
 return jsonb_build_object('id',i.id,'state',i.state,'delivery_code',i.delivery_code);
end;
$$;

create function public.cancel_account_invitation(invitation uuid,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare i public.account_invitations;
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.';end if;
 select * into strict i from public.account_invitations where id=invitation for update;
 if i.state='cancelled' and i.version=expected_version+1 then return;end if;
 if i.version<>expected_version or i.state='accepted' then raise exception 'Invitation changed. Refresh before cancelling.';end if;
 update public.account_invitations set state='cancelled',version=version+1,updated_at=now() where id=i.id;
end;
$$;
revoke all on function public.cancel_account_invitation(uuid,integer) from public,anon;
grant execute on function public.cancel_account_invitation(uuid,integer) to authenticated;

create function public.my_account_invitation() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.account_invitations;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 if exists(select 1 from public.account_roles where user_id=auth.uid()) then return null;end if;
 select * into i from public.account_invitations where target_user=auth.uid() and state<>'accepted' order by created_at desc limit 1;
 if not found then return null;end if;
 return jsonb_build_object('id',i.id,'intended_role',i.intended_role,'state',case when i.expires_at<=now() then 'expired' else i.state end,'expires_at',i.expires_at);
end;
$$;
revoke all on function public.my_account_invitation() from public,anon;
grant execute on function public.my_account_invitation() to authenticated;

create function public.accept_account_invitation(invitation uuid,adult_confirmed boolean,privacy_acknowledged boolean) returns void
language plpgsql security definer set search_path='' as $$
declare i public.account_invitations; u uuid:=auth.uid(); existing_level text;
begin
 select * into strict i from public.account_invitations where id=invitation and target_user=u for update;
 if i.state='accepted' then return;end if;
 if i.state<>'sent' or i.expires_at<=now() or adult_confirmed is distinct from true or privacy_acknowledged is distinct from true then raise exception 'A valid invitation, adult confirmation and privacy acknowledgement are required.';end if;
 if not exists(select 1 from auth.users where id=u and lower(email)=i.email and email_confirmed_at is not null) then raise exception 'Verify the invited email first.';end if;
 if not exists(select 1 from public.account_roles where user_id=i.invited_by and role='owner') then raise exception 'The inviting Owner no longer has access. Request another invitation.';end if;
 if exists(select 1 from public.guardian_managed_athletes where user_id=u) or exists(select 1 from public.family_athlete_links where athlete_user_id=u and revoked_at is null) or public.account_is_closing(u) then raise exception 'This account needs an Owner review before changing access.';end if;
 select role into existing_level from public.account_roles where user_id=u;
 if existing_level is not null then raise exception 'This account already has access. Ask an Owner to review it.';end if;
 insert into public.member_accounts(user_id,account_type,privacy_version) values(u,case when i.intended_role='parent' then 'parent' else 'adult' end,'adult-pilot-lifecycle-2026-10');
 insert into public.account_roles(user_id,role) values(u,i.intended_role);
 update public.account_invitations set state='accepted',accepted_at=now(),updated_at=now(),version=version+1 where id=i.id;
end;
$$;
revoke all on function public.accept_account_invitation(uuid,boolean,boolean) from public,anon;
grant execute on function public.accept_account_invitation(uuid,boolean,boolean) to authenticated;

-- A cancelled invite must not fall through to the ordinary member-setup RPC.
alter function public.complete_member_account(text,boolean,boolean) rename to complete_member_account_pre_lifecycle_v9;
revoke all on function public.complete_member_account_pre_lifecycle_v9(text,boolean,boolean) from public,anon,authenticated;
create function public.complete_member_account(kind text,adult_confirmed boolean,privacy_acknowledged boolean)
returns public.member_accounts language plpgsql security definer set search_path='' as $$
begin
 if public.account_is_closing(auth.uid()) then raise exception 'Account deletion is in progress.';end if;
 if not exists(select 1 from public.member_accounts where user_id=auth.uid())
  and not exists(select 1 from auth.users u cross join public.account_onboarding_settings s where u.id=auth.uid() and u.created_at<s.legacy_before)
  and not exists(select 1 from public.account_invitations where target_user=auth.uid() and state='accepted')
 then raise exception 'Accept an active Owner invitation before completing setup.';end if;
 return public.complete_member_account_pre_lifecycle_v9(kind,adult_confirmed,privacy_acknowledged);
end;
$$;
revoke all on function public.complete_member_account(text,boolean,boolean) from public,anon;
grant execute on function public.complete_member_account(text,boolean,boolean) to authenticated;

create function public.begin_account_closure(target uuid,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.account_closures; reason text;
begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,1011));
 if not exists(select 1 from auth.users where id=target) then raise exception 'Account is unavailable.';end if;
 reason:=public.account_closure_reason(target);
 if reason<>'' then raise exception 'Assisted account closure is required: %',reason;end if;
 select * into job from public.account_closures where user_id=target for update;
 if found and job.state in ('cleaning','failed') then return to_jsonb(job);end if;
 if found then delete from public.account_closures where id=job.id;end if;
 insert into public.account_closures(id,user_id,state,profile_count,video_count)
 values(request_id,target,'cleaning',(select count(*) from public.player_profiles where owner_id=target),
 (select count(*) from public.athlete_video_reviews where account_id=target or submitted_by=target)) returning * into job;
 return to_jsonb(job);
end;
$$;

-- Return only paths authorized for this deletion, never arbitrary client paths.
create function public.account_closure_media(target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.account_is_closing(target) then raise exception 'Start deletion first.';end if;
 return coalesce((select jsonb_agg(path) from
 (select asset_path as path from public.athlete_video_reviews where account_id=target or submitted_by=target
 union select name from storage.objects where bucket_id='athlete-review-videos' and split_part(name,'/',1)=target::text) paths),'[]'::jsonb);
end;
$$;

create function public.clear_account_closure_data(target uuid,request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare email_address text;
begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,1011));
 if not exists(select 1 from public.account_closures where user_id=target and id=request_id and state in ('cleaning','failed')) or public.account_closure_reason(target)<>'' then raise exception 'Account deletion needs review.';end if;
 if exists(select 1 from storage.objects o where o.bucket_id='athlete-review-videos' and
 (split_part(o.name,'/',1)=target::text or exists(select 1 from public.athlete_video_reviews v where v.asset_path=o.name and (v.account_id=target or v.submitted_by=target)))) then raise exception 'Stored media cleanup has not finished.';end if;
 select lower(email) into email_address from auth.users where id=target;
 delete from public.athlete_video_reviews where account_id=target or submitted_by=target;
 delete from public.practice_resumes where user_id=target;
 delete from public.account_invitations where target_user=target or email=email_address;
 delete from public.member_accounts where user_id=target;
 -- Other households' profiles/history remain; Auth erasure clears reporter FKs.
 update public.account_closures set state='cleaning',reason='',updated_at=now() where id=request_id;
end;
$$;

create function public.finish_account_closure(request_id uuid,failed boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.account_closures set state=case when failed then 'failed' else 'completed' end,
 reason=case when failed then 'retry_required' else '' end,updated_at=now()
 where id=request_id and state in ('cleaning','failed')
 and (failed or user_id is null);
 if not found then raise exception 'Authentication deletion is not confirmed.';end if;
end;
$$;

create function public.request_account_closure_help() returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;reason text;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 reason:=public.account_closure_reason(auth.uid());
 if reason='' then raise exception 'Use the verified customer deletion workflow.';end if;
 insert into public.account_closures(id,user_id,state,reason) values(gen_random_uuid(),auth.uid(),'assistance_requested',reason)
 on conflict(user_id) do update set state='assistance_requested',reason=excluded.reason,updated_at=now()
 returning id into result;return result;
end;
$$;
revoke all on function public.request_account_closure_help() from public,anon;
grant execute on function public.request_account_closure_help() to authenticated;

create function public.list_account_closure_requests() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.';end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from
 (select c.id,u.email,c.state,c.reason,c.created_at,c.updated_at from public.account_closures c left join auth.users u on u.id=c.user_id
 where c.state in ('assistance_requested','assistance_reviewed','failed') order by c.created_at desc limit 100) r),'[]'::jsonb);
end;
$$;
revoke all on function public.list_account_closure_requests() from public,anon;
grant execute on function public.list_account_closure_requests() to authenticated;

create function public.review_account_closure_request(request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.';end if;
 update public.account_closures set state='assistance_reviewed',updated_at=now() where id=request_id and state='assistance_requested';
 if not found then raise exception 'Request changed. Refresh requests.';end if;
end;
$$;
revoke all on function public.review_account_closure_request(uuid) from public,anon;
grant execute on function public.review_account_closure_request(uuid) to authenticated;

-- Freeze writes before enumerating media; in-flight storage inserts share this lock.
create function public.guard_closing_account_writes() returns trigger
language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 if tg_table_name='player_profiles' then u:=new.owner_id;else u:=new.user_id;end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,1011));
 if public.account_is_closing(u) then raise exception 'Account deletion is in progress.';end if;
 return new;
end;
$$;
revoke all on function public.guard_closing_account_writes() from public,anon,authenticated;
create trigger account_closure_profile_guard before insert or update on public.player_profiles for each row execute function public.guard_closing_account_writes();
create trigger account_closure_role_guard before insert or update on public.account_roles for each row execute function public.guard_closing_account_writes();

create function public.guard_closing_video_storage() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_account uuid;submitter uuid; u uuid;
begin
 if new.bucket_id<>'athlete-review-videos' then return new;end if;
 if split_part(new.name,'/',1) !~ '^[0-9a-f-]{36}$' then raise exception 'Invalid private media path.';end if;
 owner_account:=split_part(new.name,'/',1)::uuid;
 select submitted_by into submitter from public.athlete_video_reviews where asset_path=new.name;
 for u in select distinct v from unnest(array[owner_account,submitter]) v where v is not null order by v loop
  perform pg_advisory_xact_lock(hashtextextended(u::text,1011));
  if public.account_is_closing(u) then raise exception 'Account deletion is in progress.';end if;
 end loop;
 return new;
end;
$$;
revoke all on function public.guard_closing_video_storage() from public,anon,authenticated;
create trigger account_closure_storage_guard before insert or update on storage.objects for each row execute function public.guard_closing_video_storage();

-- Preserve the function OID so every existing RLS policy receives the guard.
create or replace function public.can_view_athlete(target_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not public.account_is_closing(auth.uid()) and exists(select 1 from public.player_profiles p where p.id=target_profile
 and not public.account_is_closing(p.owner_id) and (p.owner_id=auth.uid() or (
 public.child_access_ready(p.id) and exists(select 1 from public.family_athlete_links l where l.profile_id=p.id and l.athlete_user_id=auth.uid() and l.revoked_at is null))));
$$;

create or replace function public.can_view_athlete_video(review uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not public.account_is_closing(auth.uid()) and exists(select 1 from public.athlete_video_reviews v where v.id=review
 and not public.account_is_closing(v.account_id) and not public.account_is_closing(v.submitted_by)
 and (public.can_view_athlete(v.profile_id) or (v.status in ('queued','reviewed') and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a where a.account_id=v.account_id and a.video_review_enabled and a.review_coach_id=auth.uid()))));
$$;

-- Never expose privileged RPCs to browser roles, including authenticated Owners.
revoke all on function public.begin_account_invitation(uuid,uuid,text,text),public.finish_account_invitation(uuid,uuid,text),
 public.begin_account_closure(uuid,uuid),public.account_closure_media(uuid),public.clear_account_closure_data(uuid,uuid),public.finish_account_closure(uuid,boolean) from public,anon,authenticated;
grant execute on function public.begin_account_invitation(uuid,uuid,text,text),public.finish_account_invitation(uuid,uuid,text),
 public.begin_account_closure(uuid,uuid),public.account_closure_media(uuid),public.clear_account_closure_data(uuid,uuid),public.finish_account_closure(uuid,boolean) to service_role;
notify pgrst,'reload schema';

-- SOURCE 011-review-service-tracking.sql SHA256 f4880eb52c75be81819414390e1d0e01be4d9424b2b692f43dda182ac2174988
-- Additive, private fulfillment only. No billing, checkout, credits or junior media.
create table public.review_services (
 id uuid primary key,
 account_id uuid not null references public.member_accounts(user_id) on delete cascade,
 profile_id uuid not null references public.player_profiles(id) on delete cascade,
 video_id uuid unique references public.athlete_video_reviews(id) on delete set null,
 requested_by uuid references auth.users(id) on delete set null,
 assigned_to uuid references auth.users(id) on delete set null,
 drill_title text not null default 'One drill review',
 state text not null default 'requested' check(state in ('requested','uploading','pending_parent','queued','in_review','delivered','cancelled')),
 funding text not null default 'manual_pilot' check(funding='manual_pilot'),
 blocker text not null default 'none' check(blocker in ('none','access_needed','customer_follow_up','technical_issue')),
 ready_at timestamptz,
 due_at timestamptz,
 delivered_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version integer not null default 1
);
create unique index review_services_one_request on public.review_services(profile_id) where state='requested';
create index review_services_due on public.review_services(state,due_at);
create table public.review_service_events (
 id bigint generated always as identity primary key,
 service_id uuid not null references public.review_services(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 event text not null,
 created_at timestamptz not null default now()
);
alter table public.review_services enable row level security;
alter table public.review_service_events enable row level security;
revoke all on public.review_services,public.review_service_events from anon,authenticated;
-- All reads use narrow RPC projections. Operational access does not expose clips or profiles.
create function public.review_service_payload(s public.review_services) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'account_id',s.account_id,'profile_id',s.profile_id,'video_id',s.video_id,'assigned_to',s.assigned_to,'drill_title',s.drill_title,'state',s.state,'funding',s.funding,'blocker',s.blocker,'ready_at',s.ready_at,'due_at',s.due_at,'delivered_at',s.delivered_at,'created_at',s.created_at,'updated_at',s.updated_at,'version',s.version);
$$;
create function public.request_drill_review(request_id uuid,target_profile uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; s public.review_services;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,1111));
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 select * into strict p from public.player_profiles where id=target_profile;
 perform pg_advisory_xact_lock(hashtextextended(p.owner_id::text,1011));
 if public.account_is_closing(p.owner_id) then raise exception 'Account deletion is in progress.';end if;
 if p.owner_id<>auth.uid() or p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles where profile_id=p.id) then raise exception 'An adult account holder is required. Junior requests are not open.';end if;
 select * into s from public.review_services where id=request_id;
 if found then
  if s.profile_id<>target_profile or s.requested_by<>auth.uid() then raise exception 'Request ID is unavailable.';end if;
  return public.review_service_payload(s);
 end if;
 select * into s from public.review_services where profile_id=target_profile and state='requested';
 if found then return public.review_service_payload(s);end if;
 insert into public.review_services(id,account_id,profile_id,requested_by,blocker)
 values(request_id,p.owner_id,p.id,auth.uid(),case when public.can_submit_athlete_video(p.id) then 'none' else 'access_needed' end) returning * into s;
 insert into public.review_service_events(service_id,actor_id,event) values(s.id,auth.uid(),'customer_requested');
 return public.review_service_payload(s);
end;
$$;
create function public.cancel_drill_review(request_id uuid,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.review_services s set state='cancelled',updated_at=now(),version=version+1
 where s.id=request_id and s.state='requested' and s.version=expected_version and s.account_id=auth.uid() and public.can_view_athlete(s.profile_id);
 if not found then raise exception 'Request changed. Refresh before cancelling.';end if;
 insert into public.review_service_events(service_id,actor_id,event) values(request_id,auth.uid(),'customer_cancelled');
end;
$$;
create function public.my_review_services(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 return coalesce((select jsonb_agg(public.review_service_payload(s) order by s.created_at desc) from (select * from public.review_services where profile_id=target_profile order by created_at desc limit 100) s),'[]'::jsonb);
end;
$$;
create function public.review_service_desk() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(public.current_account_role(),'') not in ('owner','manager') or public.account_is_closing(auth.uid()) then raise exception 'Owner or Manager access is required.';end if;
 return jsonb_build_object('requests',coalesce((select jsonb_agg(public.review_service_payload(s) order by s.created_at desc) from public.review_services s where not public.account_is_closing(s.account_id)),'[]'::jsonb),
 'staff',coalesce((select jsonb_agg(jsonb_build_object('id',r.user_id,'label',u.email,'role',r.role) order by u.email) from public.account_roles r join auth.users u on u.id=r.user_id where r.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(r.user_id)),'[]'::jsonb));
end;
$$;
create function public.manage_review_service(request_id uuid,coach uuid,blocker_code text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare s public.review_services;
begin
 if coalesce(public.current_account_role(),'') not in ('owner','manager') or public.account_is_closing(auth.uid()) then raise exception 'Owner or Manager access is required.';end if;
 if blocker_code is null or blocker_code not in ('none','access_needed','customer_follow_up','technical_issue') then raise exception 'Choose a valid follow-up.';end if;
 if coach is not null and not exists(select 1 from public.account_roles r join auth.users u on u.id=r.user_id where r.user_id=coach and r.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(r.user_id)) then raise exception 'Choose an approved coach.';end if;
 select * into s from public.review_services where id=request_id for update;
 if not found or s.version<>expected_version or s.state in ('delivered','cancelled') or public.account_is_closing(s.account_id) then raise exception 'Request changed. Refresh before saving.';end if;
 update public.review_services set assigned_to=coach,blocker=blocker_code,updated_at=now(),version=version+1 where id=s.id;
 insert into public.review_service_events(service_id,actor_id,event) values(s.id,auth.uid(),'assignment_or_follow_up_updated');
end;
$$;
create function public.start_drill_review(review_id uuid,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.review_services s set state='in_review',updated_at=now(),version=version+1 where s.video_id=review_id and s.state='queued' and exists(select 1 from public.athlete_video_reviews v where v.id=review_id and v.version=expected_version) and s.assigned_to=auth.uid() and public.current_account_role() in ('owner','manager','coach') and public.can_view_athlete_video(review_id);
 if not found then
  if exists(select 1 from public.review_services s join public.athlete_video_reviews v on v.id=s.video_id where s.video_id=review_id and s.state='in_review' and s.assigned_to=auth.uid() and v.version=expected_version and public.can_view_athlete_video(review_id)) then return;end if;
  raise exception 'Review changed. Refresh before starting.';end if;
 insert into public.review_service_events(service_id,actor_id,event) select id,auth.uid(),'coach_started' from public.review_services where video_id=review_id;
end;
$$;
create function public.sync_video_review_service() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.review_services; ready timestamptz;
begin
 if tg_op='DELETE' then
  update public.review_services set state=case when state='delivered' then 'delivered' else 'cancelled' end,updated_at=now(),version=version+1 where video_id=old.id;
  return old;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text,1111));
 select * into s from public.review_services where video_id=new.id for update;
 if not found then
  select * into s from public.review_services where profile_id=new.profile_id and state='requested' for update;
  if not found then
   insert into public.review_services(id,account_id,profile_id,video_id,requested_by,assigned_to,drill_title,state)
   values(new.id,new.account_id,new.profile_id,new.id,new.submitted_by,(select review_coach_id from public.member_training_access where account_id=new.account_id),new.drill_title,case when new.status='reviewed' then 'delivered' else new.status end) returning * into s;
  else
   update public.review_services set video_id=new.id,drill_title=new.drill_title,assigned_to=coalesce(assigned_to,(select review_coach_id from public.member_training_access where account_id=new.account_id)) where id=s.id returning * into s;
  end if;
 end if;
 -- Start the fixed 48-hour target only after a complete upload and any parent approval.
 ready:=case when new.status in ('queued','reviewed') then coalesce(s.ready_at,new.reviewed_at,now()) else s.ready_at end;
 update public.review_services set state=case when new.status='reviewed' then 'delivered' when new.status='queued' and s.state='in_review' then 'in_review' else new.status end,
 ready_at=ready,due_at=case when ready is not null then coalesce(s.due_at,ready+interval '48 hours') else null end,
 delivered_at=case when new.status='reviewed' then coalesce(s.delivered_at,new.reviewed_at,now()) else s.delivered_at end,
 blocker=case when s.blocker='access_needed' then 'none' else s.blocker end,updated_at=now(),version=version+1 where id=s.id;
 if tg_op='INSERT' or old.status is distinct from new.status then
  insert into public.review_service_events(service_id,actor_id,event) values(s.id,auth.uid(),'video_'||new.status);
 end if;
 return new;
end;
$$;
create trigger sync_video_service after insert or update on public.athlete_video_reviews for each row execute function public.sync_video_review_service();
create trigger remove_video_service before delete on public.athlete_video_reviews for each row execute function public.sync_video_review_service();
-- Existing submissions receive the same metadata; never reset a clock on reassignment or refresh.
insert into public.review_services(id,account_id,profile_id,video_id,requested_by,assigned_to,drill_title,state,ready_at,due_at,delivered_at,created_at)
select v.id,v.account_id,v.profile_id,v.id,v.submitted_by,a.review_coach_id,v.drill_title,case when v.status='reviewed' then 'delivered' else v.status end,
case when v.status in ('queued','reviewed') then v.created_at end,case when v.status in ('queued','reviewed') then v.created_at+interval '48 hours' end,v.reviewed_at,v.created_at
from public.athlete_video_reviews v left join public.member_training_access a on a.account_id=v.account_id;

-- Assignment grants access only to this ready clip, with existing account freezes and access switch.
create or replace function public.can_view_athlete_video(review uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not public.account_is_closing(auth.uid()) and exists(select 1 from public.athlete_video_reviews v where v.id=review and not public.account_is_closing(v.account_id) and not public.account_is_closing(v.submitted_by)
 and (public.can_view_athlete(v.profile_id) or (v.status in ('queued','reviewed') and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a join public.review_services s on s.account_id=a.account_id where a.account_id=v.account_id and a.video_review_enabled and s.video_id=v.id and s.assigned_to=auth.uid()))));
$$;
create or replace function public.save_athlete_video_feedback(review_id uuid,feedback_text text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if feedback_text is null or length(btrim(feedback_text)) not between 1 and 3000 then raise exception 'Enter coaching feedback, up to 3000 characters.';end if;
 update public.athlete_video_reviews v set feedback=btrim(feedback_text),status='reviewed',reviewed_by=auth.uid(),reviewed_at=now(),version=version+1
 where v.id=review_id and v.status in ('queued','reviewed') and v.version=expected_version and public.can_view_athlete_video(v.id) and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.review_services s where s.video_id=v.id and s.assigned_to=auth.uid());
 if not found then raise exception 'Review access or version changed. Refresh before retrying.';end if;
end;
$$;
-- Additive fields keep older clients working.
create or replace function public.athlete_video_state(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 return jsonb_build_object('service_tracking',true,'can_submit',public.can_submit_athlete_video(target_profile),'remaining_slots',greatest(0,5-(select count(*) from public.athlete_video_reviews v where v.account_id=(select owner_id from public.player_profiles where id=target_profile))),'adult_only',exists(select 1 from public.player_profiles p where p.id=target_profile and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id))),'reviews',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from (select * from public.athlete_video_reviews where profile_id=target_profile order by created_at desc limit 50) v),'[]'::jsonb),'services',public.my_review_services(target_profile));
end;
$$;
revoke all on function public.review_service_payload(public.review_services),public.sync_video_review_service() from public,anon,authenticated;
revoke all on function public.request_drill_review(uuid,uuid),public.cancel_drill_review(uuid,integer),public.my_review_services(uuid),public.review_service_desk(),public.manage_review_service(uuid,uuid,text,integer),public.start_drill_review(uuid,integer) from public,anon;
grant execute on function public.request_drill_review(uuid,uuid),public.cancel_drill_review(uuid,integer),public.my_review_services(uuid),public.review_service_desk(),public.manage_review_service(uuid,uuid,text,integer),public.start_drill_review(uuid,integer) to authenticated;
notify pgrst,'reload schema';

-- SOURCE 012-per-athlete-workout-assignments.sql SHA256 430bbc0731594162d28ac67ca62fb3986d47f852f7280ddccb02ba99cfc57fab
-- REVIEW DRAFT: apply once after 011 only after explicit migration/release approval.
-- No production migration, enrollment, consent, billing or scheduler activation.

-- An explicit row (including a removal tombstone) overrides the legacy account
-- default for this athlete only. Existing defaults and loose grants stay intact.
create table public.athlete_workout_assignments (
 profile_id uuid primary key references public.player_profiles(id) on delete cascade,
 workout_id uuid references public.training_workouts(id) on delete set null,
 workout_title text not null default '', summary text not null default '',
 resource_ids uuid[] not null default '{}', workout_version integer not null default 0,
 version integer not null check(version>0),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.athlete_workout_assignments enable row level security;
revoke all on public.athlete_workout_assignments from public,anon,authenticated;
grant select on public.athlete_workout_assignments to authenticated;
create function public.can_read_athlete_workout_assignment(target_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.can_view_athlete(target_profile) or (public.current_account_role()='owner' and not public.account_is_closing(auth.uid()) and exists(select 1 from public.player_profiles p where p.id=target_profile and not public.account_is_closing(p.owner_id)));
$$;
revoke all on function public.can_read_athlete_workout_assignment(uuid) from public,anon;
grant execute on function public.can_read_athlete_workout_assignment(uuid) to authenticated;
create policy "Athlete-scoped assignment visibility" on public.athlete_workout_assignments for select to authenticated
 using(public.can_read_athlete_workout_assignment(profile_id));

-- Internal only: preserves the established snapshot shape and default behavior.
create function public.effective_workout_assignment(target_profile uuid)
returns public.member_workout_assignments language plpgsql stable security definer set search_path='' as $$
declare result public.member_workout_assignments; account uuid;
begin
 select owner_id into account from public.player_profiles where id=target_profile;
 select account,a.workout_id,a.workout_title,a.summary,a.resource_ids,a.workout_version,a.version,a.updated_at,a.updated_by
 into result from public.athlete_workout_assignments a where a.profile_id=target_profile;
 if found then return result;end if;
 select * into result from public.member_workout_assignments where account_id=account;
 return result;
end;
$$;
revoke all on function public.effective_workout_assignment(uuid) from public,anon,authenticated;

create function public.assert_workout_customer(target_account uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is distinct from 'owner' or public.account_is_closing(auth.uid()) then raise exception 'Owner access is required.';end if;
 if public.account_is_closing(target_account) or not exists(
 select 1 from public.member_accounts a join auth.users u on u.id=a.user_id join public.account_roles r on r.user_id=a.user_id
 where a.user_id=target_account and u.email_confirmed_at is not null and a.adult_confirmed_at is not null
 and a.privacy_acknowledged_at is not null and r.role in ('parent','athlete')) then raise exception 'Choose a verified adult customer account.';end if;
end;
$$;
revoke all on function public.assert_workout_customer(uuid) from public,anon,authenticated;

create function public.workout_assignment_profiles(target_account uuid)
returns table(id uuid,nickname text,age_group text,"position" text)
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.assert_workout_customer(target_account);
 return query select p.id,p.nickname,p.age_group,p.position from public.player_profiles p where p.owner_id=target_account order by p.nickname,p.id;
end;
$$;
create function public.profile_workout_assignment(target_account uuid,target_profile uuid)
returns public.member_workout_assignments language plpgsql stable security definer set search_path='' as $$
begin
 perform public.assert_workout_customer(target_account);
 if not exists(select 1 from public.player_profiles where id=target_profile and owner_id=target_account) then raise exception 'Choose an athlete in this customer account.';end if;
 return public.effective_workout_assignment(target_profile);
end;
$$;
create function public.profile_workout_preview(workout uuid,workout_version integer,target_account uuid,target_profile uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare w public.training_workouts;
begin
 perform public.profile_workout_assignment(target_account,target_profile);
 select * into w from public.training_workouts where id=workout and version=workout_version;
 if not found then raise exception 'Workout changed. Refresh before assigning.';end if;
 return jsonb_build_object('eligible',public.workout_matches_athlete(target_profile,w.resource_ids));
end;
$$;
create function public.assign_profile_workout(target_account uuid,target_profile uuid,workout uuid,workout_version integer,expected_version integer)
returns public.member_workout_assignments language plpgsql security definer set search_path='' as $$
declare w public.training_workouts; result public.member_workout_assignments;
begin
 perform public.assert_workout_customer(target_account);
 perform pg_advisory_xact_lock(hashtextextended(target_account::text,1011));
 perform pg_advisory_xact_lock(hashtextextended(target_account::text,8));
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 perform public.assert_workout_customer(target_account);
 perform 1 from public.player_profiles where id=target_profile and owner_id=target_account for share;
 if not found then raise exception 'Choose an athlete in this customer account.';end if;
 result:=public.effective_workout_assignment(target_profile);
 if workout is not null then
  select * into w from public.training_workouts where id=workout and version=workout_version for share;
  if not found then raise exception 'Workout changed. Refresh before assigning.';end if;
  if not public.workout_matches_athlete(target_profile,w.resource_ids) then raise exception 'This athlete does not match every drill. Existing access is unchanged.';end if;
 end if;
 if coalesce(result.version,0) is distinct from expected_version then
  if exists(select 1 from public.athlete_workout_assignments where profile_id=target_profile)
   and result.version=expected_version+1 and result.workout_id is not distinct from workout
   and (workout is null or (result.workout_version=workout_version and result.resource_ids=w.resource_ids)) then return result;end if;
  raise exception 'Assignment changed. Reload before saving.';
 end if;
 insert into public.athlete_workout_assignments(profile_id,workout_id,workout_title,summary,resource_ids,workout_version,version,updated_by)
 values(target_profile,w.id,coalesce(w.title,''),coalesce(w.summary,''),coalesce(w.resource_ids,'{}'),coalesce(w.version,0),coalesce(result.version,0)+1,auth.uid())
 on conflict(profile_id) do update set workout_id=excluded.workout_id,workout_title=excluded.workout_title,summary=excluded.summary,
 resource_ids=excluded.resource_ids,workout_version=excluded.workout_version,version=excluded.version,updated_by=excluded.updated_by,updated_at=now();
 return public.effective_workout_assignment(target_profile);
end;
$$;
revoke all on function public.workout_assignment_profiles(uuid),public.profile_workout_assignment(uuid,uuid),public.profile_workout_preview(uuid,integer,uuid,uuid),public.assign_profile_workout(uuid,uuid,uuid,integer,integer) from public,anon;
grant execute on function public.workout_assignment_profiles(uuid),public.profile_workout_assignment(uuid,uuid),public.profile_workout_preview(uuid,integer,uuid,uuid),public.assign_profile_workout(uuid,uuid,uuid,integer,integer) to authenticated;

-- Existing read, completion and resume gates now resolve the same athlete snapshot.
create or replace function public.clear_removed_workout_assignments() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.member_workout_assignments set workout_id=null,workout_title='',summary='',resource_ids='{}',workout_version=0,version=version+1,updated_at=now(),updated_by=auth.uid() where workout_id=old.id;
 update public.athlete_workout_assignments set workout_id=null,workout_title='',summary='',resource_ids='{}',workout_version=0,version=version+1,updated_at=now(),updated_by=auth.uid() where workout_id=old.id;
 return old;
end;
$$;
create or replace function public.training_matches_athlete(target_profile uuid,resource uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_profiles p join public.training_resources r on r.id=resource
 where p.id=target_profile and r.status='published' and r.visibility='member_only'
 and ((p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)) or exists(select 1 from public.profile_settings where under18_enabled))
 and (r.content->'ages') ? p.age_group and (r.content->'levels') ? p.experience and (jsonb_array_length(r.content->'positions')=0 or (r.content->'positions') ? p.position)
 and (exists(select 1 from public.member_training_access a where a.account_id=p.owner_id and r.id=any(a.resource_ids))
 or exists(select 1 from public.effective_workout_assignment(p.id) a where a.workout_id is not null and r.id=any(a.resource_ids) and public.workout_matches_athlete(p.id,a.resource_ids))));
$$;
create or replace function public.athlete_training_plan_internal_v8(target_profile uuid) returns setof public.training_resources language plpgsql stable security definer set search_path='' as $$
declare assignment public.member_workout_assignments;
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.'; end if;
 select * into assignment from public.effective_workout_assignment(target_profile);
 if found and assignment.workout_id is not null and public.workout_matches_athlete(target_profile,assignment.resource_ids) then
  return query select r.* from unnest(assignment.resource_ids) with ordinality d(id,ordinality) join public.training_resources r on r.id=d.id order by d.ordinality;
 else
  -- A nonmatching sibling keeps their previous explicitly granted loose drills.
  return query select r.* from public.training_resources r join public.member_training_access a on r.id=any(a.resource_ids) join public.player_profiles p on p.owner_id=a.account_id where p.id=target_profile and public.training_matches_athlete(p.id,r.id) order by r.created_at desc limit 100;
 end if;
end;
$$;
create or replace function public.family_profile_state(target_profile uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; family boolean; is_parent boolean; allowed boolean; can_record boolean; history jsonb; control_version integer; assignment public.member_workout_assignments; assigned jsonb;
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 family:=exists(select 1 from public.member_accounts where user_id=p.owner_id and account_type='parent');
 is_parent:=family and p.owner_id=auth.uid();
 select self_recording_allowed,version into allowed,control_version from public.family_athlete_controls where profile_id=p.id;
 can_record:=(p.owner_id=auth.uid() or coalesce(allowed,false)) and ((p.age_group='18+' and not exists(select 1 from public.family_minor_profiles where profile_id=p.id)) or exists(select 1 from public.profile_settings where under18_enabled));
 select coalesce(jsonb_agg(to_jsonb(w) order by w.created_at desc),'[]'::jsonb) into history from (select * from public.athlete_workouts where profile_id=p.id order by created_at desc limit 50) w;
 select * into assignment from public.effective_workout_assignment(p.id);
 if found and assignment.workout_id is not null then assigned:=jsonb_build_object('id',assignment.workout_id,'title',assignment.workout_title,'summary',assignment.summary,'resource_ids',assignment.resource_ids,'version',assignment.workout_version,'eligible',public.workout_matches_athlete(p.id,assignment.resource_ids)); end if;
 return jsonb_build_object('guardian_managed',exists(select 1 from public.family_minor_profiles where profile_id=p.id),'is_family',family,'is_parent',is_parent,'can_record',can_record,'self_recording_allowed',coalesce(allowed,false),'permission_version',coalesce(control_version,0),'has_link',exists(select 1 from public.family_athlete_links where profile_id=p.id and revoked_at is null),'child_access_ready',coalesce(public.child_access_ready(p.id),false),'workouts',history,'assigned_workout',assigned);
end;
$$;
create or replace function public.report_athlete_workout(workout_id uuid,target_profile uuid,requested_drills text[])
returns public.athlete_workouts language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; family boolean; is_parent boolean; titles text[]; total integer; eligible integer; result public.athlete_workouts; assignment public.member_workout_assignments; is_assigned boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 if (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles where profile_id=p.id)) and not exists(select 1 from public.profile_settings where under18_enabled) then raise exception 'Under-18 workout recording is not open.'; end if;
 family:=exists(select 1 from public.member_accounts where user_id=p.owner_id and account_type='parent');is_parent:=family and p.owner_id=auth.uid();
 if p.owner_id<>auth.uid() and not exists(select 1 from public.family_athlete_controls where profile_id=p.id and self_recording_allowed) then raise exception 'The parent has paused independent workout recording.'; end if;
 select * into result from public.athlete_workouts where id=workout_id;
 if found then
  if result.profile_id=target_profile and result.reported_by=auth.uid() and result.drill_ids=requested_drills then return result; end if;
  raise exception 'This workout ID was already used.';
 end if;
 select * into assignment from public.effective_workout_assignment(p.id);
 is_assigned:=found and assignment.workout_id is not null and public.workout_matches_athlete(p.id,assignment.resource_ids);
 if requested_drills is null or cardinality(requested_drills) not between 1 and 12 or (select count(distinct d) from unnest(requested_drills) d)<>cardinality(requested_drills)
 or (is_assigned and requested_drills is distinct from assignment.resource_ids::text[]) or (not is_assigned and cardinality(requested_drills)>3) then raise exception 'Complete the current assigned session in its saved order. Refresh before starting again.'; end if;
 select count(*)::integer,array_agg(r.content->>'title' order by d.ordinality),sum((r.content->>'minutes')::integer)::integer into eligible,titles,total from unnest(requested_drills) with ordinality d(id,ordinality) join public.training_resources r on r.id::text=d.id where public.training_matches_athlete(target_profile,r.id);
 if eligible<>cardinality(requested_drills) or total not between 1 and 60 then raise exception 'This session does not match the athlete’s current training access.'; end if;
 insert into public.athlete_workouts(id,profile_id,reported_by,drill_ids,titles,minutes,status,reviewed_by,reviewed_at,training_workout_id,workout_title,workout_version)
 values(workout_id,p.id,auth.uid(),requested_drills,titles,total,case when is_parent then 'approved' when family then 'pending_parent' else 'self_reported' end,case when is_parent then auth.uid() else null end,case when is_parent then now() else null end,case when is_assigned then assignment.workout_id end,case when is_assigned then assignment.workout_title end,case when is_assigned then assignment.workout_version end) returning * into result;
 return result;
end;
$$;
create or replace function public.report_saved_workout(workout_id uuid,target_profile uuid,requested_drills text[],expected_workout uuid,expected_workout_version integer)
returns public.athlete_workouts language plpgsql security definer set search_path='' as $$
declare result public.athlete_workouts; assignment public.member_workout_assignments;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into result from public.athlete_workouts where id=workout_id;
 if found then
  if result.profile_id=target_profile and result.reported_by=auth.uid() and result.drill_ids=requested_drills and result.training_workout_id=expected_workout and result.workout_version=expected_workout_version then return result; end if;
  raise exception 'This workout ID was already used.';
 end if;
 -- Serialize with per-athlete changes and hold the applicable default snapshot.
 perform 1 from public.athlete_workout_assignments where profile_id=target_profile for share;
 if not found then perform 1 from public.member_workout_assignments a join public.player_profiles p on p.owner_id=a.account_id where p.id=target_profile for share of a;end if;
 select * into assignment from public.effective_workout_assignment(target_profile);
 if not found or assignment.workout_id is distinct from expected_workout or assignment.workout_version is distinct from expected_workout_version or assignment.resource_ids::text[] is distinct from requested_drills then raise exception 'The assigned workout changed. Refresh before starting again.'; end if;
 return public.report_athlete_workout(workout_id,target_profile,requested_drills);
end;
$$;
create or replace function public.practice_resume_valid(r public.practice_resumes) returns boolean language plpgsql stable security definer set search_path='' as $$
declare context jsonb; a public.member_workout_assignments;
begin
 if r.user_id is distinct from auth.uid() or r.expires_at<=now() or not public.can_view_athlete(r.profile_id) then return false;end if;
 context:=public.family_profile_state(r.profile_id);
 if not coalesce((context->>'can_record')::boolean,false) or r.permission_version<>coalesce((context->>'permission_version')::integer,0) then return false;end if;
 if exists(select 1 from generate_subscripts(r.resource_ids,1) i where not exists(select 1 from public.training_resources d where d.id=r.resource_ids[i] and d.version=r.resource_versions[i] and d.status='published' and d.review_stage='approved' and public.training_matches_athlete(r.profile_id,d.id))) then return false;end if;
 select * into a from public.effective_workout_assignment(r.profile_id);
 if a.workout_id is not null then return r.workout_id=a.workout_id and r.workout_version=a.workout_version and r.assignment_version=a.version and r.resource_ids=a.resource_ids;end if;
 return r.workout_id is null and r.assignment_version=coalesce(a.version,0);
end;
$$;
create or replace function public.save_practice_resume(target_profile uuid,session uuid,resources uuid[],resource_versions integer[],current_position integer,expected_version integer,expected_workout uuid default null,expected_workout_version integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb;r public.practice_resumes;a public.member_workout_assignments;next_row public.practice_resumes;
begin
 if auth.uid() is null or not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 context:=public.family_profile_state(target_profile);
 if not coalesce((context->>'can_record')::boolean,false) then raise exception 'Workout recording is not permitted.';end if;
 if exists(select 1 from public.athlete_workouts where id=session) then raise exception 'This practice was already recorded.';end if;
 if session is null or resources is null or cardinality(resources) not between 1 and 12 or cardinality(resources)<>(select count(distinct x) from unnest(resources) x) or resource_versions is null or cardinality(resource_versions)<>cardinality(resources) or current_position is null or current_position<0 or current_position>=cardinality(resources) then raise exception 'Choose a valid workout current_position.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||target_profile::text,9));
 select * into r from public.practice_resumes where user_id=auth.uid() and profile_id=target_profile for update;
 if found and not public.practice_resume_valid(r) then delete from public.practice_resumes where user_id=auth.uid() and profile_id=target_profile;r:=null;end if;
 select * into a from public.effective_workout_assignment(target_profile);
 if coalesce(r.version,0)<>expected_version then
  if r.version=expected_version+1 and r.session_id=session and r.resource_ids=resources and r.resource_versions=resource_versions and r.current_index=current_position then return to_jsonb(r)-'user_id';end if;
  raise exception 'Practice changed on another device. Close and reload training.';
 end if;
 if r.session_id is not null and r.session_id<>session then raise exception 'Discard the saved practice before starting another.';end if;
 next_row.user_id:=auth.uid();next_row.profile_id:=target_profile;next_row.session_id:=session;next_row.resource_ids:=resources;next_row.resource_versions:=resource_versions;next_row.current_index:=current_position;
 next_row.workout_id:=expected_workout;next_row.workout_version:=expected_workout_version;next_row.assignment_version:=coalesce(a.version,0);
 next_row.permission_version:=coalesce((context->>'permission_version')::integer,0);next_row.expires_at:=now()+interval '7 days';
 if not public.practice_resume_valid(next_row) or not public.valid_workout_resources(resources) then raise exception 'This workout changed or is no longer available. Reload training.';end if;
 insert into public.practice_resumes(user_id,profile_id,session_id,resource_ids,resource_versions,current_index,workout_id,workout_version,assignment_version,permission_version)
 values(next_row.user_id,target_profile,session,resources,resource_versions,current_position,expected_workout,expected_workout_version,next_row.assignment_version,next_row.permission_version)
 on conflict(user_id,profile_id) do update set current_index=excluded.current_index,resource_ids=excluded.resource_ids,resource_versions=excluded.resource_versions,workout_id=excluded.workout_id,workout_version=excluded.workout_version,assignment_version=excluded.assignment_version,permission_version=excluded.permission_version,version=practice_resumes.version+1,updated_at=now(),expires_at=now()+interval '7 days' returning * into r;
 return to_jsonb(r)-'user_id';
end;
$$;
notify pgrst,'reload schema';

-- SOURCE 015-staff-client-service-dashboard.sql SHA256 013534bc410896f071e784e91bde2f3c5c80f74c7395bd51879dddd8a323d5ff
-- REVIEW DRAFT, NOT installed. Repformed's existing single-project boundary.
-- Basic service metadata only; does NOT widen can_view_athlete/video permissions.
create table public.athlete_service_coaches (
 profile_id uuid primary key references public.player_profiles(id) on delete cascade,
 coach_id uuid references auth.users(id) on delete set null,
 version integer not null default 1,
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id) on delete set null
);
alter table public.athlete_service_coaches enable row level security;
revoke all on public.athlete_service_coaches from public,anon,authenticated;
grant select on public.athlete_service_coaches to authenticated;
create function public.staff_can_view_service_athlete(target_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not public.account_is_closing(auth.uid()) and exists(select 1 from public.player_profiles p where p.id=target_profile and not public.account_is_closing(p.owner_id)
 and (public.current_account_role() in ('owner','manager') or (public.current_account_role()='coach' and exists(select 1 from public.athlete_service_coaches a where a.profile_id=p.id and a.coach_id=auth.uid()))));
$$;
revoke all on function public.staff_can_view_service_athlete(uuid) from public,anon;
grant execute on function public.staff_can_view_service_athlete(uuid) to authenticated;
create policy "Scoped service coach assignments" on public.athlete_service_coaches for select to authenticated using(public.staff_can_view_service_athlete(profile_id));
create function public.assign_athlete_service_coach(target_profile uuid,coach uuid,expected_version integer)
returns public.athlete_service_coaches language plpgsql security definer set search_path='' as $$
declare a public.athlete_service_coaches;
begin
 if coalesce(public.current_account_role(),'') not in ('owner','manager') or public.account_is_closing(auth.uid()) then raise exception 'Owner or Manager access is required.';end if;
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 if coach is not null and not exists(select 1 from public.account_roles r join auth.users u on u.id=r.user_id where r.user_id=coach and r.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(r.user_id)) then raise exception 'Choose verified active coaching staff.';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,1515));
 select * into a from public.athlete_service_coaches where profile_id=target_profile for update;
 if coalesce(a.version,0) is distinct from expected_version then
  if a.version=expected_version+1 and a.coach_id is not distinct from coach then return a;end if;
  raise exception 'Coach assignment changed. Refresh before saving.';
 end if;
 insert into public.athlete_service_coaches(profile_id,coach_id,updated_by) values(target_profile,coach,auth.uid())
 on conflict(profile_id) do update set coach_id=excluded.coach_id,version=athlete_service_coaches.version+1,updated_by=auth.uid(),updated_at=now() returning * into a;
 return a;
end;
$$;
create function public.staff_athlete_service(target_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.player_profiles;a public.member_workout_assignments;c public.athlete_service_coaches;actor_role text;resources jsonb;pending integer;overdue integer;blocked integer;last_done timestamptz;last_resume timestamptz;eligible boolean;media_ready boolean;
begin
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is outside your service roster.';end if;
 actor_role:=public.current_account_role();select * into strict p from public.player_profiles where id=target_profile;
 select * into c from public.athlete_service_coaches where profile_id=p.id;
 a:=public.effective_workout_assignment(p.id);
 eligible:=a.workout_id is not null and public.workout_matches_athlete(p.id,a.resource_ids);
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.content->>'title','version',r.version,'minutes',r.content->'minutes','review_stage',r.review_stage,'reviewed_by',r.reviewed_by,'reviewed_at',r.reviewed_at,
 'upload_received',exists(select 1 from storage.objects o where o.bucket_id='training-media' and o.name=r.asset_path and coalesce((o.metadata->>'size')::bigint,0)>0 and o.metadata->>'mimetype'=r.asset_type)) order by d.ordinality),'[]'::jsonb)
 into resources from unnest(a.resource_ids) with ordinality d(id,ordinality) join public.training_resources r on r.id=d.id;
 media_ready:=jsonb_array_length(resources)>0 and not exists(select 1 from jsonb_array_elements(resources) r where not (r->>'upload_received')::boolean);
 select count(*) filter(where s.state not in ('delivered','cancelled'))::integer,
 count(*) filter(where s.state not in ('delivered','cancelled') and s.due_at<=now())::integer,
 count(*) filter(where s.state not in ('delivered','cancelled') and s.blocker<>'none')::integer into pending,overdue,blocked
 from public.review_services s where s.profile_id=p.id and (actor_role in ('owner','manager') or s.assigned_to=auth.uid());
 select max(created_at) into last_done from public.athlete_workouts where profile_id=p.id;
 select max(updated_at) into last_resume from public.practice_resumes where profile_id=p.id;
 return jsonb_build_object('client_id',p.owner_id,'client_label',case when actor_role in ('owner','manager') then (select email from auth.users where id=p.owner_id) else 'Client '||left(p.owner_id::text,8) end,
 'athlete_id',p.id,'athlete_name',p.nickname,'age_group',p.age_group,'position',p.position,'experience',p.experience,'goal',p.goal,
 'coach_id',c.coach_id,'coach_label',(select email from auth.users where id=c.coach_id),'coach_version',coalesce(c.version,0),
 'workout_id',a.workout_id,'workout_title',a.workout_title,'workout_version',a.workout_version,'assignment_updated_at',a.updated_at,'eligible_access',coalesce(eligible,false),'media_ready',media_ready,'resources',resources,
 'scheduled_at',null,'release_timezone',null,'first_available_at',null,'schedule_tracking_available',false,'observed_at',now(),
 'last_opened_at',null,'open_tracking_available',false,'last_practice_saved_at',last_resume,'last_completion_at',last_done,
 'pending_reviews',pending,'overdue_reviews',overdue,'blocked_reviews',blocked,'review_scope',case when actor_role='coach' then 'assigned_only' else 'all_for_athlete' end,
 'review_tasks',coalesce((select jsonb_agg(public.review_service_payload(s) order by s.created_at desc) from public.review_services s where s.profile_id=p.id and (actor_role in ('owner','manager') or s.assigned_to=auth.uid())),'[]'::jsonb),
 'purchase',null,'payment_tracking_available',false,'notification_status',null,'notification_tracking_available',false,
 'next_action',case when overdue>0 then 'Follow up overdue review' when blocked>0 then 'Resolve review follow-up' when c.coach_id is null then 'Assign service coach' when a.workout_id is null then 'Assign training' when not eligible then 'Review content or eligibility' when not media_ready then 'Complete training upload' when last_done is null then 'Await observed practice report' else 'Review practice participation' end);
end;
$$;
create function public.staff_client_service_roster() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor_role text;roster_rows jsonb;
begin
 actor_role:=public.current_account_role();
 if coalesce(actor_role,'') not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) then raise exception 'Staff access is required.';end if;
 select coalesce(jsonb_agg(case when p.id is not null then public.staff_athlete_service(p.id) else jsonb_build_object('client_id',a.user_id,'client_label',u.email,'athlete_id',null,'athlete_name',null,'next_action','Complete private athlete setup') end order by u.email,p.nickname),'[]'::jsonb)
 into roster_rows from public.member_accounts a join auth.users u on u.id=a.user_id join public.account_roles r on r.user_id=a.user_id
 left join public.player_profiles p on p.owner_id=a.user_id
 where r.role in ('parent','athlete') and not public.account_is_closing(a.user_id)
 and ((actor_role in ('owner','manager') and (p.id is null or public.staff_can_view_service_athlete(p.id))) or (actor_role='coach' and p.id is not null and public.staff_can_view_service_athlete(p.id)));
 return jsonb_build_object('source','account_backend','rows',roster_rows,'scope',case when actor_role='coach' then 'assigned_athletes' else 'all_repformed_clients' end,
 'coaches',case when actor_role in ('owner','manager') then coalesce((select jsonb_agg(jsonb_build_object('id',r.user_id,'label',u.email)) from public.account_roles r join auth.users u on u.id=r.user_id where r.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(r.user_id)),'[]'::jsonb) else '[]'::jsonb end);
end;
$$;
revoke all on function public.assign_athlete_service_coach(uuid,uuid,integer),public.staff_athlete_service(uuid),public.staff_client_service_roster() from public,anon;
grant execute on function public.assign_athlete_service_coach(uuid,uuid,integer),public.staff_athlete_service(uuid),public.staff_client_service_roster() to authenticated;
notify pgrst,'reload schema';

-- SOURCE 016-delivery-monitoring-and-inbox.sql SHA256 48e60192cc29d04c1b52a62db089af9f4c783cd1a6022a2b429a3951e2eb276a
-- REVIEW DRAFT ONLY. No production application, scheduler, sender or push setup.
-- Requires 012 and 015; compatible with the existing 011 single-clip schema.
-- Grouped migrations 013/014 are optional and NOT part of the minimal release.
-- Manual checks record observation time, never a fabricated first-delivery time.
create table public.delivery_monitor_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into public.delivery_monitor_settings default values;
create table public.delivery_packages(
 id uuid primary key,title text not null check(length(btrim(title)) between 1 and 80),
 rule jsonb not null,version integer not null default 1,updated_at timestamptz not null default now()
);
create table public.delivery_client_settings(
 client_id uuid primary key references public.member_accounts(user_id) on delete cascade,
 package_id uuid not null references public.delivery_packages(id),overrides jsonb not null default '{}',
 state text not null default 'active' check(state in ('active','paused','cancelled')),
 version integer not null default 1
);
create table public.delivery_athlete_settings(
 profile_id uuid primary key references public.player_profiles(id) on delete cascade,
 overrides jsonb not null default '{}',state text not null default 'active' check(state in ('active','paused','cancelled')),
 version integer not null default 1
);
create table public.delivery_expectations(
 id uuid primary key,profile_id uuid not null references public.player_profiles(id) on delete cascade,
 cycle_key text not null check(length(btrim(cycle_key)) between 1 and 80),
 workout_id uuid references public.training_workouts(id) on delete set null,workout_version integer not null,
 resource_versions jsonb not null,rule_snapshot jsonb not null,
 due_at timestamptz not null,notice_not_before timestamptz not null,
 state text not null default 'active' check(state in ('active','paused','cancelled')),
 first_observed_available_at timestamptz,last_checked_at timestamptz,last_checked_by uuid references auth.users(id) on delete set null,
 unique(profile_id,cycle_key),check(notice_not_before<=due_at)
);
create table public.delivery_alerts(
 expectation_id uuid primary key references public.delivery_expectations(id) on delete cascade,
 state text not null check(state in ('open','acknowledged','resolved')),
 opened_at timestamptz not null default now(),acknowledged_at timestamptz,acknowledged_by uuid references auth.users(id) on delete set null,
 resolved_at timestamptz,resolution text,escalated_at timestamptz,
 episode integer not null default 1
);
create table public.content_notices(
 id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.player_profiles(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('training_ready','review_ready')),
 source_id uuid not null,source_version text not null,event_key text not null unique,
 observed_at timestamptz not null default now(),read_at timestamptz,
 email_status text not null default 'disabled' check(email_status='disabled')
);
-- No browser raw table reads/writes, including configuration and outbox.
alter table public.delivery_monitor_settings enable row level security;
alter table public.delivery_packages enable row level security;
alter table public.delivery_client_settings enable row level security;
alter table public.delivery_athlete_settings enable row level security;
alter table public.delivery_expectations enable row level security;
alter table public.delivery_alerts enable row level security;
alter table public.content_notices enable row level security;
revoke all on public.delivery_monitor_settings,public.delivery_packages,public.delivery_client_settings,public.delivery_athlete_settings,public.delivery_expectations,public.delivery_alerts,public.content_notices from public,anon,authenticated;

create function public.validate_delivery_rule(patch jsonb,full_rule boolean) returns void
language plpgsql stable security definer set search_path='' as $$
declare k text;
begin
 if patch is null or jsonb_typeof(patch) is distinct from 'object' then raise exception 'Choose valid delivery settings.';end if;
 for k in select jsonb_object_keys(patch) loop
  if k not in ('weekday','time','timezone','grace_minutes','escalation_minutes','routing','notify_training','notify_reviews','email_requested','submission_reminders','submission_cadence_hours','submission_expectation') or patch->k='null'::jsonb then raise exception 'Unknown or empty delivery setting.';end if;
 end loop;
 if full_rule and not patch ?& array['weekday','time','timezone','grace_minutes','escalation_minutes','routing','notify_training','notify_reviews','email_requested','submission_reminders'] then raise exception 'Complete the package delivery defaults.';end if;
 if patch ? 'weekday' and (jsonb_typeof(patch->'weekday')<>'number' or (patch->>'weekday') !~ '^[0-6]$') then raise exception 'Choose a due day.';end if;
 if patch ? 'time' and (patch->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Choose a valid local due time.';end if;
 if patch ? 'timezone' and not exists(select 1 from pg_timezone_names where name=patch->>'timezone') then raise exception 'Choose a valid IANA time zone.';end if;
 foreach k in array array['grace_minutes','escalation_minutes'] loop
  if patch ? k and ((patch->>k) !~ '^[0-9]{1,5}$' or (patch->>k)::integer>10080) then raise exception 'Choose a delay from 0 through 10080 minutes.';end if;
 end loop;
 if patch ? 'routing' and patch->>'routing' not in ('assigned_coach','owners_managers') then raise exception 'Choose staff-only alert routing.';end if;
 foreach k in array array['notify_training','notify_reviews','email_requested','submission_reminders'] loop
  if patch ? k and jsonb_typeof(patch->k)<>'boolean' then raise exception 'Choose valid notification preferences.';end if;
 end loop;
 if patch->>'submission_reminders'='true' then raise exception 'Submission reminder meaning and cadence require review; keep disabled.';end if;
 if patch ? 'submission_cadence_hours' and ((patch->>'submission_cadence_hours') !~ '^[0-9]{1,3}$' or (patch->>'submission_cadence_hours')::integer not between 1 and 168) then raise exception 'Choose a draft reminder cadence from 1 through 168 hours.';end if;
 if patch ? 'submission_expectation' and (jsonb_typeof(patch->'submission_expectation')<>'string' or length(btrim(patch->>'submission_expectation')) not between 1 and 200) then raise exception 'Describe the draft expected submission in 1 through 200 characters.';end if;
end;
$$;
create function public.delivery_rule_for(target_profile uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select d.rule||c.overrides||coalesce(a.overrides,'{}') from public.player_profiles p
 join public.delivery_client_settings c on c.client_id=p.owner_id join public.delivery_packages d on d.id=c.package_id
 left join public.delivery_athlete_settings a on a.profile_id=p.id where p.id=target_profile;
$$;
create function public.assert_delivery_owner() returns void language plpgsql stable security definer set search_path='' as $$
begin if public.current_account_role() is distinct from 'owner' or public.account_is_closing(auth.uid()) then raise exception 'Owner access is required for delivery configuration.';end if;end;
$$;
create function public.save_delivery_package(package_id uuid,title text,rule jsonb,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare old public.delivery_packages;
begin
 perform public.assert_delivery_owner();perform public.validate_delivery_rule(rule,true);
 perform pg_advisory_xact_lock(hashtextextended(package_id::text,1616));
 select * into old from public.delivery_packages where id=package_id for update;
 if coalesce(old.version,0)<>expected_version then
  if old.version=expected_version+1 and old.title=title and old.rule=rule then return;end if;
  raise exception 'Delivery defaults changed. Refresh before saving.';
 end if;
 insert into public.delivery_packages(id,title,rule) values(package_id,btrim(title),rule)
 on conflict(id) do update set title=excluded.title,rule=excluded.rule,version=delivery_packages.version+1,updated_at=now();
end;
$$;
create function public.save_delivery_override(target_profile uuid,scope text,package_id uuid,overrides jsonb,state text,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare customer uuid;v integer;old jsonb;old_package uuid;old_state text;
begin
 perform public.assert_delivery_owner();perform public.validate_delivery_rule(overrides,false);
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 select owner_id into customer from public.player_profiles where id=target_profile;
 -- Serialize the shared client row across different sibling editors.
 perform pg_advisory_xact_lock(hashtextextended(customer::text,1617));
 if state not in ('active','paused','cancelled') or state is null then raise exception 'Choose a service state.';end if;
 if scope='client' then
  select c.version,c.overrides,c.package_id,c.state into v,old,old_package,old_state from public.delivery_client_settings c where c.client_id=customer for update;
  if coalesce(v,0)<>expected_version then
   if v=expected_version+1 and old=overrides and old_package=package_id and old_state=state then return;end if;
   raise exception 'Client delivery settings changed. Refresh.';
  end if;
  insert into public.delivery_client_settings(client_id,package_id,overrides,state) values(customer,package_id,overrides,state)
  on conflict(client_id) do update set package_id=excluded.package_id,overrides=excluded.overrides,state=excluded.state,version=delivery_client_settings.version+1;
 elsif scope='athlete' then
  if state not in ('active','paused','cancelled') or state is null then raise exception 'Choose an athlete service state.';end if;
  select a.version,a.overrides,a.state into v,old,old_state from public.delivery_athlete_settings a where a.profile_id=target_profile for update;
  if coalesce(v,0)<>expected_version then
   if v=expected_version+1 and old=overrides and old_state=state then return;end if;
   raise exception 'Athlete delivery settings changed. Refresh.';
  end if;
  insert into public.delivery_athlete_settings(profile_id,overrides,state) values(target_profile,overrides,state)
  on conflict(profile_id) do update set overrides=excluded.overrides,state=excluded.state,version=delivery_athlete_settings.version+1;
 else raise exception 'Choose client or athlete settings.';end if;
end;
$$;
create function public.delivery_wall_instant(local_date date,local_time text,zone text) returns timestamptz
language plpgsql stable security definer set search_path='' as $$
declare wall timestamp;result timestamptz;n integer;
begin
 perform public.validate_delivery_rule(jsonb_build_object('time',local_time,'timezone',zone),false);
 if local_date is null then raise exception 'Choose a calendar date.';end if;
 wall:=local_date+local_time::time;
 -- Compare candidate offsets on both sides of a clock transition. Reject skipped
 -- and repeated local times; never silently pick one side of an ambiguous hour.
 select count(distinct candidate),min(candidate) into n,result from (
  select (wall at time zone 'UTC')-((t at time zone zone)-(t at time zone 'UTC')) candidate
  from generate_series((wall at time zone 'UTC')-interval '36 hours',(wall at time zone 'UTC')+interval '36 hours',interval '12 hours') t
 ) c where candidate at time zone zone=wall;
 if n<>1 then raise exception 'That local time is skipped or repeated by a clock change. Choose another time.';end if;
 return result;
end;
$$;
create function public.plan_delivery_check(check_id uuid,target_profile uuid,cycle_key text,workout uuid,workout_version integer,local_date date,notice_not_before timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare rule jsonb;due timestamptz;w public.training_workouts;snap jsonb;old public.delivery_expectations;
begin
 perform public.assert_delivery_owner();
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 rule:=public.delivery_rule_for(target_profile);
 if rule is null then raise exception 'Choose package defaults for this client first.';end if;
 if extract(dow from local_date)::integer<>(rule->>'weekday')::integer then raise exception 'The date must match the configured due day.';end if;
 due:=public.delivery_wall_instant(local_date,rule->>'time',rule->>'timezone');
 if notice_not_before is null or notice_not_before>due then raise exception 'Choose a notice boundary at or before the delivery deadline.';end if;
 select * into w from public.training_workouts where id=workout and version=workout_version;
 if not found then raise exception 'Choose the current saved workout version.';end if;
 select jsonb_object_agg(r.id::text,r.version) into snap from public.training_resources r where r.id=any(w.resource_ids);
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,1618));
 select * into old from public.delivery_expectations where id=check_id;
 if found then
  if old.profile_id=target_profile and old.cycle_key=cycle_key and old.workout_id=workout and old.workout_version=workout_version and old.due_at=due and old.notice_not_before=notice_not_before and old.rule_snapshot=rule and old.resource_versions=snap then return;end if;
  raise exception 'This delivery check ID already has different details.';
 end if;
 insert into public.delivery_expectations(id,profile_id,cycle_key,workout_id,workout_version,resource_versions,rule_snapshot,due_at,notice_not_before)
 values(check_id,target_profile,btrim(cycle_key),workout,workout_version,snap,rule,due,notice_not_before);
end;
$$;
create function public.delivery_recipient(target_profile uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select p.owner_id from public.player_profiles p join public.member_accounts a on a.user_id=p.owner_id join auth.users u on u.id=p.owner_id
 where p.id=target_profile and u.email_confirmed_at is not null and not public.account_is_closing(p.owner_id)
 and not exists(select 1 from public.guardian_managed_athletes g where g.user_id=p.owner_id)
 and ((p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id))
 or (a.account_type='parent' and p.guardian_confirmed and exists(select 1 from public.profile_settings where under18_enabled)
 and exists(select 1 from public.guardian_access_reviews g where g.profile_id=p.id)));
$$;
create function public.set_delivery_check_state(check_id uuid,state text,expected_state text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.delivery_expectations;
begin
 perform public.assert_delivery_owner();
 if state is null or state not in ('active','paused','cancelled') then raise exception 'Choose a delivery-check state.';end if;
 select * into e from public.delivery_expectations where id=check_id for update;
 if not found or not public.staff_can_view_service_athlete(e.profile_id) then raise exception 'This delivery check is unavailable.';end if;
 if e.state=state then return;end if;
 if e.state is distinct from expected_state then raise exception 'This delivery check changed. Refresh.';end if;
 update public.delivery_expectations set state=set_delivery_check_state.state where id=check_id;
end;
$$;
create function public.delivery_check_available(e public.delivery_expectations) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare a public.member_workout_assignments;
begin
 -- Monitoring pause/cancellation does not revoke actual training access.
 if public.delivery_recipient(e.profile_id) is null then return false;end if;
 a:=public.effective_workout_assignment(e.profile_id);
 return coalesce(a.workout_id=e.workout_id and a.workout_version=e.workout_version and cardinality(a.resource_ids)=(select count(*) from jsonb_object_keys(e.resource_versions))
 and public.workout_matches_athlete(e.profile_id,a.resource_ids)
 and not exists(select 1 from jsonb_each(e.resource_versions) expected left join public.training_resources r on r.id::text=expected.key
 where r.id is null or not(r.id=any(a.resource_ids)) or r.version<>(expected.value::text)::integer or r.review_stage<>'approved' or r.status<>'published'
 or not exists(select 1 from storage.objects o where o.bucket_id='training-media' and o.name=r.asset_path and coalesce((o.metadata->>'size')::bigint,0)>0 and o.metadata->>'mimetype'=r.asset_type)),false);
end;
$$;
create function public.evaluate_delivery_checks(target_profile uuid) returns void
language plpgsql security definer set search_path='' as $$
declare e public.delivery_expectations;s public.review_services;rule jsonb;recipient uuid;ready boolean;paused boolean;v public.athlete_video_reviews;
begin
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is outside your service roster.';end if;
 if not exists(select 1 from public.delivery_monitor_settings where enabled) then raise exception 'Manual delivery monitoring has not been activated.';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,1618));
 recipient:=public.delivery_recipient(target_profile);
 rule:=public.delivery_rule_for(target_profile);
 paused:=exists(select 1 from public.delivery_athlete_settings where profile_id=target_profile and state<>'active') or exists(select 1 from public.delivery_client_settings c join public.player_profiles p on p.owner_id=c.client_id where p.id=target_profile and c.state<>'active');
 for e in select * from public.delivery_expectations where profile_id=target_profile for update loop
  ready:=public.delivery_check_available(e);
  update public.delivery_expectations set last_checked_at=now(),last_checked_by=auth.uid(),first_observed_available_at=case when ready then coalesce(first_observed_available_at,now()) else first_observed_available_at end where id=e.id;
  if paused or e.state<>'active' or ready then
   update public.delivery_alerts set state='resolved',resolved_at=coalesce(resolved_at,now()),resolution=case when ready then 'Accessible when checked' else 'Service paused or cancelled' end where expectation_id=e.id and state<>'resolved';
  elsif now()>=e.due_at+make_interval(mins=>(e.rule_snapshot->>'grace_minutes')::integer) then
   insert into public.delivery_alerts(expectation_id,state) values(e.id,'open') on conflict(expectation_id) do update set
    state=case when delivery_alerts.state='resolved' then 'open' else delivery_alerts.state end,
    episode=delivery_alerts.episode+case when delivery_alerts.state='resolved' then 1 else 0 end,
    opened_at=case when delivery_alerts.state='resolved' then now() else delivery_alerts.opened_at end,
    acknowledged_at=case when delivery_alerts.state='resolved' then null else delivery_alerts.acknowledged_at end,
    acknowledged_by=case when delivery_alerts.state='resolved' then null else delivery_alerts.acknowledged_by end,
    escalated_at=case when delivery_alerts.state='resolved' then null else delivery_alerts.escalated_at end,resolved_at=null,resolution=null;
   update public.delivery_alerts set escalated_at=coalesce(escalated_at,now()) where expectation_id=e.id and state='open'
    and (e.rule_snapshot->>'escalation_minutes')::integer>0 and now()>=e.due_at+make_interval(mins=>(e.rule_snapshot->>'grace_minutes')::integer+(e.rule_snapshot->>'escalation_minutes')::integer);
  end if;
  if ready and not paused and e.state='active' and now()>=e.notice_not_before and coalesce((e.rule_snapshot->>'notify_training')::boolean,false) and coalesce((rule->>'notify_training')::boolean,false) then
   insert into public.content_notices(profile_id,recipient_id,kind,source_id,source_version,event_key)
   values(target_profile,recipient,'training_ready',e.id,e.workout_version::text,'training:'||e.id::text||':'||recipient::text) on conflict(event_key) do nothing;
  end if;
 end loop;
 -- Reviews are a separate content-ready event; no athlete submission reminder
 -- is inferred from an overdue staff delivery or a raw upload.
 if not paused and recipient is not null and coalesce((rule->>'notify_reviews')::boolean,false) then
  for s in select * from public.review_services where profile_id=target_profile and state='delivered' and delivered_at is not null loop
   if public.current_account_role()='coach' and s.assigned_to is distinct from auth.uid() then continue;end if;
   select * into v from public.athlete_video_reviews where id=s.video_id;
   if (coalesce((to_jsonb(s)->>'is_grouped')::boolean,false) and (to_jsonb(s)->>'group_submitted_at') is not null and (to_jsonb(s)->>'group_reviewed_by') is not null and not coalesce((to_jsonb(s)->>'group_erased')::boolean,false) and length(btrim((to_jsonb(s)->>'group_feedback')))>0)
    or (not coalesce((to_jsonb(s)->>'is_grouped')::boolean,false) and v.status='reviewed' and v.reviewed_by is not null and length(btrim(v.feedback))>0 and exists(select 1 from storage.objects o where o.bucket_id='athlete-review-videos' and o.name=v.asset_path)) then
    insert into public.content_notices(profile_id,recipient_id,kind,source_id,source_version,event_key)
    values(target_profile,recipient,'review_ready',s.id,s.delivered_at::text,'review:'||s.id::text||':'||s.delivered_at::text||':'||recipient::text) on conflict(event_key) do nothing;
   end if;
  end loop;
 end if;
end;
$$;
create function public.acknowledge_delivery_alert(check_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.delivery_expectations e where e.id=check_id and public.staff_can_view_service_athlete(e.profile_id)
 and (public.current_account_role() in ('owner','manager') or e.rule_snapshot->>'routing'='assigned_coach')) then raise exception 'This staff alert is outside your scope.';end if;
 update public.delivery_alerts set state='acknowledged',acknowledged_at=now(),acknowledged_by=auth.uid() where expectation_id=check_id and state='open';
end;
$$;
create function public.delivery_profile_workspace(target_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare customer uuid;result jsonb;
begin
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is outside your service roster.';end if;
 select owner_id into customer from public.player_profiles where id=target_profile;
 return jsonb_build_object('manual_only',true,'email_adapter','disabled','enabled',coalesce((select enabled from public.delivery_monitor_settings),false),
 'packages',coalesce((select jsonb_agg(to_jsonb(p) order by title) from public.delivery_packages p where public.current_account_role()='owner' or p.id=(select package_id from public.delivery_client_settings where client_id=customer)),'[]'::jsonb),
 'client', (select to_jsonb(c) from public.delivery_client_settings c where client_id=customer),
 'athlete',(select to_jsonb(a) from public.delivery_athlete_settings a where profile_id=target_profile),'effective_rule',public.delivery_rule_for(target_profile),
 'checks',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('available_now',public.delivery_check_available(e),'alert',
 case when public.current_account_role() in ('owner','manager') or e.rule_snapshot->>'routing'='assigned_coach' then (select to_jsonb(a) from public.delivery_alerts a where expectation_id=e.id) else null end) order by e.due_at desc) from public.delivery_expectations e where e.profile_id=target_profile),'[]'::jsonb));
end;
$$;
create function public.my_content_notices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or public.account_is_closing(auth.uid()) then raise exception 'Verified member access is required.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'profile_id',n.profile_id,'athlete_name',(select nickname from public.player_profiles where id=n.profile_id),'kind',n.kind,'observed_at',n.observed_at,'read_at',n.read_at,'email_status',n.email_status,
 'available_now',case when n.kind='training_ready' then exists(select 1 from public.delivery_expectations e where e.id=n.source_id and public.delivery_check_available(e))
 else exists(select 1 from public.review_services s where s.id=n.source_id and s.state='delivered' and ((coalesce((to_jsonb(s)->>'is_grouped')::boolean,false) and (to_jsonb(s)->>'group_submitted_at') is not null and (to_jsonb(s)->>'group_reviewed_by') is not null and not coalesce((to_jsonb(s)->>'group_erased')::boolean,false) and length(btrim((to_jsonb(s)->>'group_feedback')))>0) or exists(select 1 from public.athlete_video_reviews v where v.id=s.video_id and v.status='reviewed' and v.reviewed_by is not null and length(btrim(v.feedback))>0))) end) order by n.observed_at desc)
 from (select * from public.content_notices where recipient_id=auth.uid() order by observed_at desc limit 100) n where public.delivery_recipient(n.profile_id)=auth.uid()),'[]'::jsonb);
end;
$$;
create function public.delivery_staff_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() not in ('owner','manager','coach') or public.current_account_role() is null or public.account_is_closing(auth.uid()) then raise exception 'Staff access is required.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'profile_id',e.profile_id,'athlete_name',p.nickname,'cycle_key',e.cycle_key,'due_at',e.due_at,'timezone',e.rule_snapshot->>'timezone','last_checked_at',e.last_checked_at,'state',a.state,'escalated_at',a.escalated_at,'episode',a.episode,'available_now',public.delivery_check_available(e)) order by e.due_at)
 from public.delivery_alerts a join public.delivery_expectations e on e.id=a.expectation_id join public.player_profiles p on p.id=e.profile_id
 where a.state<>'resolved' and e.state='active' and public.staff_can_view_service_athlete(e.profile_id)
 and not exists(select 1 from public.delivery_athlete_settings s where s.profile_id=e.profile_id and s.state<>'active')
 and not exists(select 1 from public.delivery_client_settings c where c.client_id=p.owner_id and c.state<>'active')
 and (public.current_account_role() in ('owner','manager') or e.rule_snapshot->>'routing'='assigned_coach')),'[]'::jsonb);
end;
$$;
create function public.read_content_notice(notice_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.content_notices n set read_at=coalesce(read_at,now()) where n.id=notice_id and n.recipient_id=auth.uid() and public.delivery_recipient(n.profile_id)=auth.uid();
 if not found then raise exception 'This notification is unavailable.';end if;
end;
$$;
revoke all on function public.validate_delivery_rule(jsonb,boolean),public.delivery_rule_for(uuid),public.assert_delivery_owner(),public.delivery_wall_instant(date,text,text),public.delivery_recipient(uuid),public.delivery_check_available(public.delivery_expectations) from public,anon,authenticated;
revoke all on function public.save_delivery_package(uuid,text,jsonb,integer),public.save_delivery_override(uuid,text,uuid,jsonb,text,integer),public.plan_delivery_check(uuid,uuid,text,uuid,integer,date,timestamptz),public.set_delivery_check_state(uuid,text,text),public.evaluate_delivery_checks(uuid),public.acknowledge_delivery_alert(uuid),public.delivery_profile_workspace(uuid),public.my_content_notices(),public.read_content_notice(uuid) from public,anon;
grant execute on function public.save_delivery_package(uuid,text,jsonb,integer),public.save_delivery_override(uuid,text,uuid,jsonb,text,integer),public.plan_delivery_check(uuid,uuid,text,uuid,integer,date,timestamptz),public.set_delivery_check_state(uuid,text,text),public.evaluate_delivery_checks(uuid),public.acknowledge_delivery_alert(uuid),public.delivery_profile_workspace(uuid),public.my_content_notices(),public.read_content_notice(uuid) to authenticated;
notify pgrst,'reload schema';
revoke all on function public.delivery_staff_queue() from public,anon;
grant execute on function public.delivery_staff_queue() to authenticated;

-- SOURCE 017-staff-operational-notifications.sql SHA256 aad2e7784ec8676e0fe77c0e4fe6e01d05e331db29055bb6a2f9837345f3b6ed
-- REVIEW DRAFT ONLY. Requires 012/015/016; does not require grouped-media 013/014.
-- No migration, recipient selection, email send, signup trigger or cron activation
-- is authorized by adding this source. Client content updates remain IN-APP ONLY.
create table public.staff_notification_settings(
 singleton boolean primary key default true check(singleton),
 email_enabled boolean not null default false,
 inapp_observation_enabled boolean not null default false,
 email_since timestamptz,inapp_since timestamptz,
 signup_source text check(signup_source is null)
);
insert into public.staff_notification_settings default values;
create function public.guard_staff_notification_activation() returns trigger language plpgsql set search_path='' as $$
begin
 if new.email_enabled and not old.email_enabled then new.email_since:=clock_timestamp();else new.email_since:=old.email_since;end if;
 if new.inapp_observation_enabled and not old.inapp_observation_enabled then new.inapp_since:=clock_timestamp();else new.inapp_since:=old.inapp_since;end if;
 return new;
end;$$;
create trigger staff_notification_activation before update on public.staff_notification_settings for each row execute function public.guard_staff_notification_activation();
-- Selected staff IDs only: never arbitrary recipient addresses or client accounts.
-- Owner/operator recipient selection needs separate approval; initially no rows.
create table public.staff_notification_recipients(
 user_id uuid primary key references auth.users(id) on delete cascade,
 selected boolean not null default false,opted_out boolean not null default false,
 training_overdue boolean not null default true,review_overdue boolean not null default true
);
create table public.staff_notification_jobs(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('training_overdue','review_overdue')),
 profile_id uuid not null references public.player_profiles(id) on delete cascade,
 source_id uuid not null,recipient_id uuid not null references auth.users(id) on delete cascade,
 recipient_email text not null,due_at timestamptz not null,
 state text not null default 'queued' check(state in ('queued','processing','retry','accepted','failed','suppressed','uncertain')),
 attempts integer not null default 0 check(attempts between 0 and 4),
 created_at timestamptz not null default clock_timestamp(),first_attempt_at timestamptz,
 next_attempt_at timestamptz not null default clock_timestamp(),lease_token uuid,lease_until timestamptz,
 provider_id text,last_code text,updated_at timestamptz not null default clock_timestamp(),
 unique(kind,source_id,recipient_id)
);
create index staff_notification_jobs_due on public.staff_notification_jobs(state,next_attempt_at);
alter table public.staff_notification_settings enable row level security;
alter table public.staff_notification_recipients enable row level security;
alter table public.staff_notification_jobs enable row level security;
revoke all on public.staff_notification_settings,public.staff_notification_recipients,public.staff_notification_jobs from public,anon,authenticated;

create function public.operational_staff_eligible(staff uuid,target_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.account_roles r join auth.users u on u.id=r.user_id join public.player_profiles p on p.id=target_profile
 where r.user_id=staff and u.email_confirmed_at is not null and u.email is not null and not public.account_is_closing(staff)
 and not public.account_is_closing(p.owner_id) and public.delivery_recipient(p.id)=p.owner_id
 and (r.role in ('owner','manager') or (r.role='coach' and exists(select 1 from public.athlete_service_coaches c where c.profile_id=p.id and c.coach_id=staff))));
$$;
create function public.operational_source(kind text,source_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.delivery_expectations;s public.review_services;target uuid;deadline timestamptz;coach uuid;routing text;
begin
 if kind='training_overdue' then
  select * into e from public.delivery_expectations where id=source_id and state='active';
  if not found or public.delivery_check_available(e) then return null;end if;
  target:=e.profile_id;deadline:=e.due_at+make_interval(mins=>(e.rule_snapshot->>'grace_minutes')::integer);
  routing:=e.rule_snapshot->>'routing';select coach_id into coach from public.athlete_service_coaches where profile_id=target;
 elsif kind='review_overdue' then
  select * into s from public.review_services where id=source_id and state in ('queued','in_review') and ready_at is not null and due_at is not null;
  if not found or not exists(select 1 from public.member_training_access where account_id=s.account_id and video_review_enabled)
   or not exists(select 1 from public.player_profiles where id=s.profile_id and owner_id=s.account_id)
   or not exists(select 1 from public.athlete_video_reviews v join storage.objects o on o.bucket_id='athlete-review-videos' and o.name=v.asset_path
    where v.id=s.video_id and v.profile_id=s.profile_id and v.account_id=s.account_id and v.status='queued'
    and (o.metadata->>'size')::bigint=v.byte_size and o.metadata->>'mimetype'=v.media_type) then return null;end if;
  target:=s.profile_id;deadline:=s.due_at;coach:=s.assigned_to;routing:='assigned_coach';
 else return null;end if;
 if public.delivery_recipient(target) is null or exists(select 1 from public.delivery_athlete_settings where profile_id=target and state<>'active')
 or exists(select 1 from public.delivery_client_settings c join public.player_profiles p on p.owner_id=c.client_id where p.id=target and c.state<>'active') then return null;end if;
 return jsonb_build_object('profile_id',target,'due_at',deadline,'coach_id',coach,'routing',routing);
end;$$;
create function public.operational_recipient_allowed(staff uuid,kind text,source_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare source jsonb;coach uuid;role text;target uuid;
begin
 source:=public.operational_source(kind,source_id);if source is null then return false;end if;
 target:=(source->>'profile_id')::uuid;coach:=(source->>'coach_id')::uuid;
 if not public.operational_staff_eligible(staff,target) or not exists(select 1 from public.staff_notification_recipients r where r.user_id=staff and selected and not opted_out
 and case when kind='training_overdue' then training_overdue else review_overdue end) then return false;end if;
 select r.role into role from public.account_roles r where r.user_id=staff;
 if source->>'routing'='owners_managers' then return role in ('owner','manager');end if;
 if public.operational_staff_eligible(coach,target) and exists(select 1 from public.staff_notification_recipients r where r.user_id=coach and selected and not opted_out
 and case when kind='training_overdue' then training_overdue else review_overdue end) then return staff=coach;end if;
 return role in ('owner','manager');
end;$$;

-- Client-facing content readiness is IN-APP ONLY. No client email outbox exists.
create function public.notification_review_ready(service public.review_services) returns boolean
language sql stable security definer set search_path='' as $$
 select service.state='delivered' and service.delivered_at is not null
 and exists(select 1 from public.player_profiles p where p.id=service.profile_id and p.owner_id=service.account_id)
 and not coalesce((to_jsonb(service)->>'is_grouped')::boolean,false)
 and exists(select 1 from public.member_training_access a where a.account_id=service.account_id and a.video_review_enabled)
 and exists(select 1 from public.athlete_video_reviews v where v.id=service.video_id and v.profile_id=service.profile_id and v.account_id=service.account_id
 and v.status='reviewed' and v.reviewed_by is not null and length(btrim(v.feedback))>0
 and exists(select 1 from storage.objects o where o.bucket_id='athlete-review-videos' and o.name=v.asset_path));
$$;
create function public.observe_new_content_notices(batch_limit integer default 10) returns integer
language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz;item record;recipient uuid;rule jsonb;e public.delivery_expectations;s public.review_services;n integer;added integer:=0;
begin
 if batch_limit is null or batch_limit not between 1 and 10 then raise exception 'Choose a batch from 1 through 10.';end if;
 select inapp_since into cutoff from public.staff_notification_settings where inapp_observation_enabled;
 if cutoff is null then return 0;end if;
 for item in select 'training_ready'::text kind,id,profile_id from public.delivery_expectations where state='active' and notice_not_before>=cutoff and notice_not_before<=clock_timestamp()
 union all select 'review_ready',id,profile_id from public.review_services where state='delivered' and delivered_at>=cutoff loop
  recipient:=public.delivery_recipient(item.profile_id);rule:=public.delivery_rule_for(item.profile_id);
  if recipient is null or rule is null or exists(select 1 from public.delivery_athlete_settings where profile_id=item.profile_id and state<>'active')
  or exists(select 1 from public.delivery_client_settings where client_id=recipient and state<>'active') then continue;end if;
  if item.kind='training_ready' then
   select * into e from public.delivery_expectations where id=item.id;
   if not coalesce((rule->>'notify_training')::boolean,false) or not coalesce((e.rule_snapshot->>'notify_training')::boolean,false) or not public.delivery_check_available(e) then continue;end if;
   insert into public.content_notices(profile_id,recipient_id,kind,source_id,source_version,event_key)
   values(item.profile_id,recipient,item.kind,e.id,e.workout_version::text,'training:'||e.id::text||':'||recipient::text) on conflict(event_key) do nothing;
  else
   select * into s from public.review_services where id=item.id;
   if not coalesce((rule->>'notify_reviews')::boolean,false) or not public.notification_review_ready(s) then continue;end if;
   insert into public.content_notices(profile_id,recipient_id,kind,source_id,source_version,event_key)
   values(item.profile_id,recipient,item.kind,s.id,s.delivered_at::text,'review:'||s.id::text||':'||s.delivered_at::text||':'||recipient::text) on conflict(event_key) do nothing;
  end if;
  get diagnostics n=row_count;added:=added+n;if added>=batch_limit then return added;end if;
 end loop;
 return added;
end;$$;

-- Service-only preparation: one initial email per missed item/recipient, no recurring
-- reminder or historical backfill. A changed deadline suppresses an old job.
create function public.prepare_staff_notification_jobs(batch_limit integer default 10) returns integer
language plpgsql security definer set search_path='' as $$
declare item record;source jsonb;staff record;added integer:=0;n integer;cutoff timestamptz;
begin
 if batch_limit is null or batch_limit not between 1 and 10 then raise exception 'Choose a batch from 1 through 10.';end if;
 select email_since into cutoff from public.staff_notification_settings where email_enabled;
 if cutoff is null then return 0;end if;
 for item in select 'training_overdue'::text kind,id from public.delivery_expectations where state='active'
 union all select 'review_overdue',id from public.review_services where state in ('queued','in_review') loop
  source:=public.operational_source(item.kind,item.id);
  if source is null or (source->>'due_at')::timestamptz<cutoff or (source->>'due_at')::timestamptz>clock_timestamp() then continue;end if;
  for staff in select r.user_id,u.email from public.staff_notification_recipients r join auth.users u on u.id=r.user_id where public.operational_recipient_allowed(r.user_id,item.kind,item.id) loop
   insert into public.staff_notification_jobs(kind,profile_id,source_id,recipient_id,recipient_email,due_at)
   values(item.kind,(source->>'profile_id')::uuid,item.id,staff.user_id,staff.email,(source->>'due_at')::timestamptz)
   on conflict(kind,source_id,recipient_id) do nothing;
   get diagnostics n=row_count;added:=added+n;if added>=batch_limit then return added;end if;
  end loop;
 end loop;
 return added;
end;$$;
create function public.staff_notification_job_allowed(job public.staff_notification_jobs) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_notification_settings where email_enabled and email_since<=job.created_at)
 and public.operational_recipient_allowed(job.recipient_id,job.kind,job.source_id)
 and (public.operational_source(job.kind,job.source_id)->>'profile_id')::uuid=job.profile_id
 and (public.operational_source(job.kind,job.source_id)->>'due_at')::timestamptz=job.due_at
 and job.due_at<=clock_timestamp()
 and exists(select 1 from auth.users where id=job.recipient_id and email=job.recipient_email and email_confirmed_at is not null);
$$;
create function public.claim_staff_notification_jobs(batch_limit integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.staff_notification_jobs;items jsonb:='[]';
begin
 if batch_limit is null or batch_limit not between 1 and 10 then raise exception 'Choose a batch from 1 through 10.';end if;
 if not exists(select 1 from public.staff_notification_settings where email_enabled) then return items;end if;
 for j in select * from public.staff_notification_jobs where (state in ('queued','retry') and next_attempt_at<=clock_timestamp()) or (state='processing' and lease_until<clock_timestamp()) order by created_at for update skip locked limit batch_limit loop
  if not coalesce(public.staff_notification_job_allowed(j),false) then
   update public.staff_notification_jobs set state='suppressed',last_code='eligibility_changed',updated_at=clock_timestamp() where id=j.id;continue;
  end if;
  if j.first_attempt_at<=clock_timestamp()-interval '23 hours' then
   update public.staff_notification_jobs set state='uncertain',last_code='retry_window_expired',updated_at=clock_timestamp() where id=j.id;continue;
  end if;
  if j.attempts>=4 then
   update public.staff_notification_jobs set state='failed',last_code='attempt_limit',updated_at=clock_timestamp() where id=j.id;continue;
  end if;
  update public.staff_notification_jobs set state='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() where id=j.id returning * into j;
  items:=items||jsonb_build_array(jsonb_build_object('id',j.id,'kind',j.kind,'recipient_email',j.recipient_email,'lease_token',j.lease_token,'idempotency_key','repformed-staff/'||j.id::text||'/v1'));
 end loop;
 return items;
end;$$;
create function public.authorize_staff_notification_job(job_id uuid,lease uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select state='processing' and lease_token=lease and lease_until>clock_timestamp() and first_attempt_at>clock_timestamp()-interval '23 hours' and public.staff_notification_job_allowed(j)
 from public.staff_notification_jobs j where id=job_id),false);
$$;
create function public.finish_staff_notification_job(job_id uuid,lease uuid,outcome text,result_code text,provider_reference text default null,retry_after_seconds integer default 60) returns void
language plpgsql security definer set search_path='' as $$
begin
 if outcome is null or outcome not in ('accepted','retry','failed','suppressed','uncertain') or result_code is null or result_code !~ '^[a-z_]{1,50}$'
 or retry_after_seconds is null or retry_after_seconds not between 1 and 3600
 or (outcome='accepted' and (provider_reference is null or provider_reference !~ '^[a-zA-Z0-9_-]{1,100}$')) then raise exception 'Invalid dispatch outcome.';end if;
 update public.staff_notification_jobs set state=case when outcome='retry' and attempts>=4 then 'failed' else outcome end,
 last_code=result_code,provider_id=case when outcome='accepted' then provider_reference else provider_id end,
 next_attempt_at=clock_timestamp()+make_interval(secs=>retry_after_seconds),lease_until=null,updated_at=clock_timestamp()
 where id=job_id and state='processing' and lease_token=lease;
 if not found then raise exception 'Dispatch lease changed; outcome not recorded.';end if;
end;$$;

create function public.staff_notification_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is null or public.current_account_role() not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Staff access is required.';end if;
 return jsonb_build_object('email_enabled',(select email_enabled from public.staff_notification_settings),
 'inapp_observation_enabled',(select inapp_observation_enabled from public.staff_notification_settings),'signup_status','unconfigured',
 'selected',coalesce((select selected from public.staff_notification_recipients where user_id=auth.uid()),false),
 'opted_out',coalesce((select opted_out from public.staff_notification_recipients where user_id=auth.uid()),false),
 'jobs',coalesce((select jsonb_agg(item order by created_at desc) from (select j.created_at,jsonb_build_object('id',j.id,'kind',j.kind,'profile_id',j.profile_id,'athlete_name',p.nickname,'state',j.state,'attempts',j.attempts,'due_at',j.due_at,'updated_at',j.updated_at,'code',j.last_code,
 'provider_id',case when public.current_account_role() in ('owner','manager') then j.provider_id else null end) item
 from public.staff_notification_jobs j join public.player_profiles p on p.id=j.profile_id
 where public.staff_can_view_service_athlete(j.profile_id) and (public.current_account_role() in ('owner','manager') or j.recipient_id=auth.uid()) order by j.created_at desc limit 100) recent),'[]'::jsonb));
end;$$;
create function public.set_staff_notification_opt_out(opt_out boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if opt_out is null or public.current_account_role() is null or public.current_account_role() not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Configured staff access is required.';end if;
 update public.staff_notification_recipients set opted_out=opt_out where user_id=auth.uid() and selected;
 if not found then raise exception 'An Owner must select notification recipients first.';end if;
end;$$;
revoke all on function public.guard_staff_notification_activation(),public.operational_staff_eligible(uuid,uuid),public.operational_source(text,uuid),public.operational_recipient_allowed(uuid,text,uuid),public.staff_notification_job_allowed(public.staff_notification_jobs),public.notification_review_ready(public.review_services) from public,anon,authenticated;
revoke all on function public.observe_new_content_notices(integer),public.prepare_staff_notification_jobs(integer),public.claim_staff_notification_jobs(integer),public.authorize_staff_notification_job(uuid,uuid),public.finish_staff_notification_job(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.observe_new_content_notices(integer),public.prepare_staff_notification_jobs(integer),public.claim_staff_notification_jobs(integer),public.authorize_staff_notification_job(uuid,uuid),public.finish_staff_notification_job(uuid,uuid,text,text,text,integer) to service_role;
revoke all on function public.staff_notification_workspace(),public.set_staff_notification_opt_out(boolean) from public,anon;
grant execute on function public.staff_notification_workspace(),public.set_staff_notification_opt_out(boolean) to authenticated;
notify pgrst,'reload schema';

-- SOURCE 018-public-interest-and-shared-inbox.sql SHA256 68793bda5c1f80964f852c7abd665075ca14a640cd456410edd542f7c9bb4a5f
-- REVIEW DRAFT ONLY. Requires 017 plus its 012/015/016 dependencies.
-- No hosted application, public endpoint, credential or sender activation implied.

create table public.interest_intake_settings(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 window_started_at timestamptz not null default clock_timestamp(),
 accepted_in_window integer not null default 0 check(accepted_in_window>=0),
 window_limit integer not null default 10 check(window_limit between 1 and 100),
 email_daily_limit integer not null default 3 check(email_daily_limit between 1 and 10)
);
insert into public.interest_intake_settings default values;
create table public.interest_requests(
 id uuid primary key,
 adult_name text not null default '' check(length(adult_name)<=60 and adult_name!~'[[:cntrl:]]'),
 contact_email text not null check(length(contact_email)<=254 and contact_email=lower(btrim(contact_email)) and contact_email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 package_interest text not null check(package_interest in ('undecided','foundation','fundamentals','position-development','elite-coaching')),
 adult_declared_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default clock_timestamp()
);
create index interest_requests_contact_created on public.interest_requests(contact_email,created_at);
-- Immutable per-submission preferences; no legacy rows are populated.
create table public.interest_submission_events(
 submission_id uuid primary key,
 interest_id uuid not null references public.interest_requests(id) on delete cascade,
 payload_digest text not null,
 launch_requested boolean not null default false,
 notice_version text,
 notice_text text,
 recorded_at timestamptz not null default clock_timestamp(),
 check((notice_version is null and notice_text is null and not launch_requested) or
       (notice_version='repformed-launch-notice-v1' and notice_text='Email me when Repformed launches'))
);
create index interest_submission_events_history on public.interest_submission_events(interest_id,recorded_at);
alter table public.interest_submission_events enable row level security;
revoke all on public.interest_submission_events from public,anon,authenticated;

alter table public.interest_intake_settings enable row level security;
alter table public.interest_requests enable row level security;
revoke all on public.interest_intake_settings,public.interest_requests from public,anon,authenticated;

-- Shared business inbox only. Verified Owner/Manager recipient routing is future
-- work, not a selectable mode. Do not activate 017 by itself after this revision.
alter table public.staff_notification_settings add column routing_mode text not null default 'shared_inbox' check(routing_mode='shared_inbox');
alter table public.staff_notification_settings drop constraint staff_notification_settings_signup_source_check;
alter table public.staff_notification_settings add check(signup_source is null or signup_source='interest_submission');
update public.staff_notification_settings set signup_source='interest_submission';
alter table public.staff_notification_jobs drop constraint staff_notification_jobs_kind_check;
alter table public.staff_notification_jobs add check(kind in ('training_overdue','review_overdue','interest_received'));
alter table public.staff_notification_jobs alter column profile_id drop not null;
alter table public.staff_notification_jobs alter column recipient_id drop not null;
alter table public.staff_notification_jobs add column route text not null default 'legacy_staff' check(route in ('legacy_staff','shared_inbox'));
alter table public.staff_notification_jobs add check(route<>'shared_inbox' or (recipient_id is null and lower(recipient_email)='repformed@gmail.com'));
alter table public.staff_notification_jobs add check((kind='interest_received')=(profile_id is null));
create unique index shared_notification_once on public.staff_notification_jobs(kind,source_id) where route='shared_inbox';
update public.staff_notification_jobs set state='suppressed',last_code='routing_superseded' where route='legacy_staff' and state in ('queued','retry','processing');
update public.staff_notification_recipients set selected=false;

create function public.shared_notification_source(kind text,source_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare x public.interest_requests;
begin
 if kind='interest_received' then
  select * into x from public.interest_requests where id=source_id;
  if not found then return null;end if;
  return jsonb_build_object('profile_id',null,'due_at',x.created_at);
 end if;
 return public.operational_source(kind,source_id);
end;$$;

create or replace function public.prepare_staff_notification_jobs(batch_limit integer default 10) returns integer
language plpgsql security definer set search_path='' as $$
declare item record;source jsonb;cutoff timestamptz;n integer;added integer:=0;
begin
 if batch_limit is null or batch_limit not between 1 and 10 then raise exception 'Choose a batch from 1 through 10.';end if;
 select email_since into cutoff from public.staff_notification_settings where email_enabled and routing_mode='shared_inbox';
 if cutoff is null then return 0;end if;
 for item in select 'training_overdue'::text kind,id from public.delivery_expectations where state='active'
 union all select 'review_overdue',id from public.review_services where state in ('queued','in_review')
 union all select 'interest_received',id from public.interest_requests where created_at>=cutoff loop
  source:=public.shared_notification_source(item.kind,item.id);
  if source is null or (source->>'due_at')::timestamptz<cutoff or (source->>'due_at')::timestamptz>clock_timestamp() then continue;end if;
  insert into public.staff_notification_jobs(kind,profile_id,source_id,recipient_email,due_at,route)
  values(item.kind,(source->>'profile_id')::uuid,item.id,'Repformed@gmail.com',(source->>'due_at')::timestamptz,'shared_inbox')
  on conflict(kind,source_id) where route='shared_inbox' do nothing;
  get diagnostics n=row_count;added:=added+n;if added>=batch_limit then return added;end if;
 end loop;
 return added;
end;$$;
create or replace function public.staff_notification_job_allowed(job public.staff_notification_jobs) returns boolean
language sql stable security definer set search_path='' as $$
 select job.route='shared_inbox' and job.recipient_id is null and lower(job.recipient_email)='repformed@gmail.com'
 and exists(select 1 from public.staff_notification_settings where email_enabled and routing_mode='shared_inbox' and email_since<=job.created_at)
 and public.shared_notification_source(job.kind,job.source_id) is not null
 and (public.shared_notification_source(job.kind,job.source_id)->>'profile_id')::uuid is not distinct from job.profile_id
 and (public.shared_notification_source(job.kind,job.source_id)->>'due_at')::timestamptz=job.due_at
 and job.due_at<=clock_timestamp();
$$;

-- Service-only intake; the future public Edge Function supplies validated data.
-- Locking the singleton serializes duplicate and budget decisions atomically.
create function public.accept_public_interest(submission_id uuid,adult_name text,adult_email text,package_interest text,adult_confirmed boolean,launch_updates boolean default false,consent_version text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare config public.interest_intake_settings;existing public.interest_requests;event public.interest_submission_events;email text:=lower(btrim(adult_email));name text:=btrim(coalesce(adult_name,''));stamp timestamptz:=clock_timestamp();digest text;target uuid;fresh boolean:=false;
begin
 if submission_id is null or adult_confirmed is distinct from true or adult_email is null or length(email)>254 or email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or length(name)>60 or name~'[[:cntrl:]]' or package_interest is null or package_interest not in ('undecided','foundation','fundamentals','position-development','elite-coaching')
 or launch_updates is null or (consent_version is not null and consent_version<>'repformed-launch-notice-v1') or (launch_updates and consent_version is distinct from 'repformed-launch-notice-v1') then raise exception 'Invalid adult interest request.';end if;
 digest:=encode(sha256(convert_to(jsonb_build_array(name,email,package_interest,launch_updates,consent_version)::text,'UTF8')),'hex');
 select * into config from public.interest_intake_settings where singleton for update;
 if not config.enabled then return jsonb_build_object('status','disabled');end if;
 select * into event from public.interest_submission_events e where e.submission_id=accept_public_interest.submission_id;
 if found then
  if event.payload_digest<>digest then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','accepted','dispatch_id',event.interest_id);
 end if;
 -- An older request with no shown notice does not gain retroactive consent.
 select * into existing from public.interest_requests where id=submission_id;
 if found then
  if existing.contact_email<>email or existing.adult_name<>name or existing.package_interest<>package_interest or launch_updates then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','accepted','dispatch_id',existing.id);
 end if;
 if config.window_started_at<=stamp-interval '10 minutes' then
  update public.interest_intake_settings set window_started_at=stamp,accepted_in_window=0 where singleton;config.accepted_in_window:=0;
 end if;
 if config.accepted_in_window>=config.window_limit or (select count(*) from public.interest_submission_events e join public.interest_requests i on i.id=e.interest_id where i.contact_email=email and e.recorded_at>stamp-interval '24 hours')>=config.email_daily_limit then return jsonb_build_object('status','rate_limited');end if;
 select * into existing from public.interest_requests i where i.contact_email=email and i.package_interest=accept_public_interest.package_interest and i.created_at>stamp-interval '24 hours' order by created_at desc limit 1;
 if found then target:=existing.id;
 else
  target:=submission_id;fresh:=true;
  insert into public.interest_requests(id,adult_name,contact_email,package_interest) values(submission_id,name,email,package_interest);
 end if;
 insert into public.interest_submission_events(submission_id,interest_id,payload_digest,launch_requested,notice_version,notice_text)
 values(submission_id,target,digest,launch_updates,consent_version,case when consent_version is not null then 'Email me when Repformed launches' else null end);
 update public.interest_intake_settings set accepted_in_window=accepted_in_window+1 where singleton;
 if fresh and exists(select 1 from public.staff_notification_settings where email_enabled and routing_mode='shared_inbox' and email_since<=stamp) then
  insert into public.staff_notification_jobs(kind,source_id,recipient_email,due_at,route)
  select 'interest_received',id,'Repformed@gmail.com',created_at,'shared_inbox' from public.interest_requests where id=target;
 end if;
 return jsonb_build_object('status','accepted','dispatch_id',target);
end;$$;

-- One submission-triggered attempt, not a cron or an arbitrary outbox drain.
create function public.claim_interest_notification(request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.staff_notification_jobs;
begin
 select * into j from public.staff_notification_jobs where kind='interest_received' and source_id=request_id and route='shared_inbox'
 and ((state in ('queued','retry') and next_attempt_at<=clock_timestamp()) or (state='processing' and lease_until<clock_timestamp())) for update skip locked;
 if not found then return null;end if;
 if not coalesce(public.staff_notification_job_allowed(j),false) then update public.staff_notification_jobs set state='suppressed',last_code='eligibility_changed',updated_at=clock_timestamp() where id=j.id;return null;end if;
 if j.first_attempt_at<=clock_timestamp()-interval '23 hours' then update public.staff_notification_jobs set state='uncertain',last_code='retry_window_expired',updated_at=clock_timestamp() where id=j.id;return null;end if;
 if j.attempts>=4 then update public.staff_notification_jobs set state='failed',last_code='attempt_limit',updated_at=clock_timestamp() where id=j.id;return null;end if;
 update public.staff_notification_jobs set state='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() where id=j.id returning * into j;
 return jsonb_build_object('id',j.id,'kind',j.kind,'recipient_email',j.recipient_email,'lease_token',j.lease_token,'idempotency_key','repformed-staff/'||j.id::text||'/v1');
end;$$;

create function public.interest_staff_inbox() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is null or public.current_account_role() not in ('owner','manager') or public.account_is_closing(auth.uid()) or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Owner or Manager access required.';end if;
 return coalesce((select jsonb_agg(item order by created_at desc) from (select i.created_at,jsonb_build_object('id',i.id,'adult_name',i.adult_name,'email',i.contact_email,'package_interest',i.package_interest,'created_at',i.created_at,'email_state',coalesce(j.state,'disabled'),'launch_choice',case when pref.notice_version is not null then pref.launch_requested else null end,'launch_choice_at',case when pref.notice_version is not null then pref.recorded_at else null end,'launch_notice_version',pref.notice_version,'launch_requested_at',positive.recorded_at,'launch_requested_version',positive.notice_version) item from public.interest_requests i left join public.staff_notification_jobs j on j.kind='interest_received' and j.source_id=i.id and j.route='shared_inbox' left join lateral(select e.* from public.interest_submission_events e where e.interest_id=i.id order by e.recorded_at desc limit 1) pref on true left join lateral(select e.recorded_at,e.notice_version from public.interest_submission_events e join public.interest_requests original on original.id=e.interest_id where original.contact_email=i.contact_email and e.launch_requested order by e.recorded_at desc limit 1) positive on true order by i.created_at desc limit 100) recent),'[]'::jsonb);
end;$$;
create or replace function public.staff_notification_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is null or public.current_account_role() not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Staff access is required.';end if;
 return jsonb_build_object('email_enabled',(select email_enabled from public.staff_notification_settings),'inapp_observation_enabled',(select inapp_observation_enabled from public.staff_notification_settings),'signup_status','interest_submission','routing_mode','shared_inbox','recipient_label','Repformed@gmail.com','selected',false,'opted_out',false,
 'jobs',coalesce((select jsonb_agg(item order by created_at desc) from (select j.created_at,jsonb_build_object('id',j.id,'kind',j.kind,'profile_id',j.profile_id,'athlete_name',case when j.kind='interest_received' then 'New interest request' else p.nickname end,'state',j.state,'attempts',j.attempts,'due_at',j.due_at,'updated_at',j.updated_at,'code',j.last_code,'provider_id',case when public.current_account_role() in ('owner','manager') then j.provider_id else null end) item from public.staff_notification_jobs j left join public.player_profiles p on p.id=j.profile_id
 where j.route='shared_inbox' and (public.current_account_role() in ('owner','manager') or (j.profile_id is not null and public.staff_can_view_service_athlete(j.profile_id))) order by j.created_at desc limit 100) recent),'[]'::jsonb));
end;$$;
create or replace function public.set_staff_notification_opt_out(opt_out boolean) returns void
language plpgsql security definer set search_path='' as $$
begin raise exception 'Shared inbox routing has no personal recipient preferences.';end;$$;

revoke all on function public.shared_notification_source(text,uuid),public.accept_public_interest(uuid,text,text,text,boolean,boolean,text),public.claim_interest_notification(uuid) from public,anon,authenticated;
grant execute on function public.accept_public_interest(uuid,text,text,text,boolean,boolean,text),public.claim_interest_notification(uuid) to service_role;
revoke all on function public.interest_staff_inbox() from public,anon;
grant execute on function public.interest_staff_inbox() to authenticated;
notify pgrst,'reload schema';

-- SOURCE 019-weekly-learning.sql SHA256 25a88837586ee9cbed1914a3bf7235bdd934e4fba12577d3b07be0eb2df3657b
-- DRAFT: additive learning system. Not applied to production.
-- Requires 001–012,015–018 only. No grouped review dependency or live cron.
create table public.learning_settings(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 scheduler_enabled boolean not null default false,
 notices_enabled boolean not null default false,
 youth_enabled boolean not null default false,
 friday_time time not null default '17:00',
 low_ready_weeks integer not null default 2 check(low_ready_weeks between 1 and 8)
);
insert into public.learning_settings default values;
create table public.learning_quizzes(
 id uuid primary key, title text not null check(length(title) between 1 and 160),
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);
create table public.learning_quiz_versions(
 id uuid primary key,quiz_id uuid not null references public.learning_quizzes(id),
 revision integer not null check(revision>0),questions jsonb not null,
 total_points integer not null check(total_points between 1 and 10000),
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 unique(quiz_id,revision)
);
create table public.learning_quiz_keys(
 version_id uuid primary key references public.learning_quiz_versions(id),keys jsonb not null
);
create table public.learning_plans(
 id uuid primary key,title text not null check(length(title) between 1 and 160),
 weeks integer not null check(weeks between 1 and 104),
 package_ids text[] not null default '{}',ages text[] not null default '{}',positions text[] not null default '{}',
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);
-- Every save appends a version. Approval is an explicit Owner/Manager action.
create table public.learning_week_versions(
 id uuid primary key,plan_id uuid not null references public.learning_plans(id),
 week_number integer not null check(week_number between 0 and 104),revision integer not null,
 title text not null check(length(title) between 1 and 160),
 resources jsonb not null default '[]',quiz_version_ids uuid[] not null default '{}',
 approved_at timestamptz,approved_by uuid references auth.users(id) on delete set null,retracted_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 unique(plan_id,week_number,revision)
);
create table public.learning_cohorts(
 id uuid primary key,title text not null check(length(title) between 1 and 100),created_by uuid references auth.users(id) on delete set null
);
create table public.learning_cohort_members(
 cohort_id uuid references public.learning_cohorts(id) on delete cascade,profile_id uuid references public.player_profiles(id) on delete cascade,
 primary key(cohort_id,profile_id)
);
-- Manually verified eligibility, NOT evidence of a Stripe/Apple purchase.
create table public.learning_access(
 profile_id uuid primary key references public.player_profiles(id) on delete cascade,package_id text not null,
 starts_at timestamptz not null,ends_at timestamptz not null,revoked_at timestamptz,
 reason text not null check(length(reason) between 1 and 500),verified_by uuid references auth.users(id) on delete set null,
 check(ends_at>starts_at)
);
create table public.learning_enrollments(
 id uuid primary key,profile_id uuid not null references public.player_profiles(id) on delete cascade,plan_id uuid not null references public.learning_plans(id),
 state text not null default 'active' check(state in ('active','paused','ended','finished')),
 next_week integer not null default 1 check(next_week between 1 and 105),next_release_at timestamptz not null,
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),version integer not null default 1,
 ended_at timestamptz
);
create unique index one_running_learning_plan on public.learning_enrollments(profile_id) where state in ('active','paused');
create table public.learning_week_overrides(
 enrollment_id uuid references public.learning_enrollments(id) on delete cascade,week_number integer not null,
 week_version_id uuid not null references public.learning_week_versions(id),primary key(enrollment_id,week_number)
);
create table public.learning_releases(
 id uuid primary key default gen_random_uuid(),enrollment_id uuid not null references public.learning_enrollments(id) on delete cascade,
 sequence integer not null,week_number integer not null,week_version_id uuid not null references public.learning_week_versions(id),
 available_at timestamptz not null default now(),scheduled_at timestamptz not null,
 repeated_from uuid references public.learning_releases(id) on delete set null,unique(enrollment_id,sequence)
);
create table public.learning_completion(
 release_id uuid references public.learning_releases(id) on delete cascade,item_id text not null,reported_by uuid references auth.users(id) on delete set null,
 completed_at timestamptz not null default now(),status text not null check(status in ('approved','pending_parent','needs_repeat','self_reported')),version integer not null default 1,reviewed_by uuid references auth.users(id) on delete set null,reviewed_at timestamptz,primary key(release_id,item_id)
);
create table public.learning_quiz_attempts(
 id uuid primary key,release_id uuid not null references public.learning_releases(id) on delete cascade,quiz_version_id uuid not null references public.learning_quiz_versions(id),
 actor_id uuid references auth.users(id) on delete set null,answers jsonb not null default '{}',
 state text not null default 'draft' check(state in ('draft','needs_grading','graded')),
 objective_points integer,submitted_at timestamptz,created_at timestamptz not null default now(),version integer not null default 1,
 unique(release_id,quiz_version_id,actor_id,id)
);
create table public.learning_quiz_grades(
 id uuid primary key default gen_random_uuid(),attempt_id uuid not null references public.learning_quiz_attempts(id) on delete cascade,
 revision integer not null,question_points jsonb not null,feedback text not null default '' check(length(feedback)<=4000),
 graded_by uuid references auth.users(id) on delete set null,graded_at timestamptz not null default now(),unique(attempt_id,revision)
);
create table public.learning_notices(
 id uuid primary key default gen_random_uuid(),event_key text not null unique,
 profile_id uuid not null references public.player_profiles(id) on delete cascade,release_id uuid references public.learning_releases(id) on delete cascade,
 category text not null check(category in ('content_ready','friday_incomplete','low_content','no_content')),
 staff_only boolean not null,created_at timestamptz not null default now(),resolved_at timestamptz
);
create table public.learning_notice_reads(
 notice_id uuid references public.learning_notices(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,read_at timestamptz not null default now(),
 primary key(notice_id,user_id)
);
create table public.learning_audit(
 id bigint generated always as identity primary key,actor_id uuid,action text not null,target uuid,detail jsonb not null default '{}',at timestamptz not null default now()
);
-- No public/raw authenticated table access, including answer keys and grades.
do $$declare t text;begin
 foreach t in array array['learning_settings','learning_quizzes','learning_quiz_versions','learning_quiz_keys','learning_plans','learning_week_versions','learning_cohorts','learning_cohort_members','learning_access','learning_enrollments','learning_week_overrides','learning_releases','learning_completion','learning_quiz_attempts','learning_quiz_grades','learning_notices','learning_notice_reads','learning_audit'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;end$$;
create function public.learning_require_staff() returns void language plpgsql stable security definer set search_path='' as $$begin
 if not exists(select 1 from public.learning_settings where enabled) then raise exception 'Learning plans are not enabled.';end if;
 if coalesce(public.current_account_role(),'') not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) then raise exception 'Staff access is required.';end if;
end$$;
create function public.learning_require_owner() returns void language plpgsql stable security definer set search_path='' as $$begin
 perform public.learning_require_staff();if public.current_account_role()<>'owner' then raise exception 'Owner access is required.';end if;
end$$;
create function public.learning_profile_allowed(target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_settings s join public.player_profiles p on p.id=target_profile where s.enabled
 and not public.account_is_closing(auth.uid()) and not public.account_is_closing(p.owner_id)
 and (s.youth_enabled or (p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)))
 and (public.can_view_athlete(p.id) or public.staff_can_view_service_athlete(p.id)))
$$;
create function public.learning_can_submit(target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.learning_profile_allowed(target_profile) and public.can_view_athlete(target_profile) and exists(select 1 from public.player_profiles p where p.id=target_profile and (p.owner_id=auth.uid() or exists(select 1 from public.family_athlete_controls c where c.profile_id=p.id and c.self_recording_allowed)))
$$;
create function public.learning_eligible(target_profile uuid,target_plan uuid,at_time timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_access a join public.learning_plans p on p.id=target_plan join public.player_profiles f on f.id=a.profile_id
 where a.profile_id=target_profile and not public.account_is_closing(f.owner_id) and a.revoked_at is null and a.starts_at<=at_time and a.ends_at>at_time
 and (cardinality(p.package_ids)=0 or a.package_id=any(p.package_ids))
 and (cardinality(p.ages)=0 or f.age_group=any(p.ages)) and (cardinality(p.positions)=0 or f.position=any(p.positions)))
$$;
create function public.learning_next_sunday(at_time timestamptz) returns timestamptz language sql immutable set search_path='' as $$
 select ((date_trunc('week',at_time at time zone 'America/Chicago'+interval '1 day')+interval '6 days') at time zone 'America/Chicago')
$$;
-- Import API independently validates every question and answer key. No trusted client scoring.
create function public.learning_import_quiz(version_id uuid,target_quiz uuid,quiz_title text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare q jsonb;k jsonb;questions jsonb:=payload->'questions';key_items jsonb:=payload->'keys';total integer:=0;n integer:=0;rev integer;typ text;opts jsonb;v public.learning_quiz_versions;
begin
 perform public.learning_require_staff();
 if quiz_title is null or payload is null or length(trim(quiz_title)) not between 1 and 160 or jsonb_typeof(questions)<>'array' or jsonb_typeof(key_items)<>'array' then raise exception 'Invalid quiz import.';end if;
 if jsonb_array_length(questions) not between 1 and 100 or jsonb_array_length(key_items)<>jsonb_array_length(questions) then raise exception 'Include 1–100 matched questions and keys.';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_quiz::text,1919));
 if exists(select 1 from public.learning_quizzes where id=target_quiz and created_by<>auth.uid()) and public.current_account_role() not in ('owner','manager') then raise exception 'Quiz is outside your authoring scope.';end if;
 select * into v from public.learning_quiz_versions where id=version_id;
 if found then
  if v.quiz_id=target_quiz and v.questions=questions and exists(select 1 from public.learning_quizzes existing_quiz where existing_quiz.id=target_quiz and existing_quiz.title=trim(quiz_title)) and exists(select 1 from public.learning_quiz_keys existing_key where existing_key.version_id=v.id and existing_key.keys=key_items) then return v.id;end if;
  raise exception 'Import ID already exists with different data.';
 end if;
 for q in select value from jsonb_array_elements(questions) loop
  n:=n+1;typ:=q->>'type';opts:=q->'options';
  if (select count(*) from jsonb_object_keys(q))<>6 or not(q ?& array['id','order','type','question','options','points']) or coalesce(q->>'id','') !~ '^[A-Za-z0-9_-]{1,64}$' or (q->>'order')::integer<>n
   or length(trim(coalesce(q->>'question',''))) not between 1 and 2000 or (q->>'points')::numeric not between 1 and 100 or (q->>'points')::numeric<>trunc((q->>'points')::numeric)
   or jsonb_typeof(opts)<>'array' or typ not in ('multiple_choice','true_false','written') then raise exception 'Invalid question at row %.',n;end if;
  if (select count(*) from jsonb_array_elements(questions) x where x->>'id'=q->>'id')<>1 then raise exception 'Duplicate question ID.';end if;
  select value into k from jsonb_array_elements(key_items) where value->>'id'=q->>'id';
  if k is null or (select count(*) from jsonb_array_elements(key_items) x where x->>'id'=q->>'id')<>1 or (select count(*) from jsonb_object_keys(k))<>3 or not(k ?& array['id','correct','explanation']) or length(coalesce(k->>'explanation',''))>2000 then raise exception 'Invalid answer key.';end if;
  if typ='written' then
   if opts<>'[]'::jsonb or k->'correct'<>'null'::jsonb then raise exception 'Written answers require staff grading, not an answer key.';end if;
  else
   if jsonb_array_length(opts) not between 2 and 4 or exists(select 1 from jsonb_array_elements(opts) x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 400)
    or (select count(distinct x) from jsonb_array_elements(opts) x)<>jsonb_array_length(opts) or (k->>'correct')::numeric<>trunc((k->>'correct')::numeric) or (k->>'correct')::integer not between 0 and jsonb_array_length(opts)-1 then raise exception 'Invalid choices or answer key.';end if;
   if k->>'correct' is null or (typ='true_false' and opts<>'["True","False"]'::jsonb) then raise exception 'Invalid objective key.';end if;
  end if;
  total:=total+(q->>'points')::integer;
 end loop;
 insert into public.learning_quizzes(id,title,created_by) values(target_quiz,trim(quiz_title),auth.uid()) on conflict(id) do nothing;
 select coalesce(max(revision),0)+1 into rev from public.learning_quiz_versions where quiz_id=target_quiz;
 insert into public.learning_quiz_versions(id,quiz_id,revision,questions,total_points,created_by) values(version_id,target_quiz,rev,questions,total,auth.uid());
 insert into public.learning_quiz_keys values(version_id,key_items);
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'import_quiz',version_id);
 return version_id;
end$$;
create function public.learning_create_plan(target_id uuid,plan_title text,week_count integer,packages text[],age_groups text[],position_groups text[]) returns uuid
language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_staff();
 if exists(select 1 from public.learning_plans where id=target_id) then
  if exists(select 1 from public.learning_plans p where p.id=target_id and p.created_by=auth.uid() and p.title=trim(plan_title) and p.weeks=week_count and p.package_ids=packages and p.ages=age_groups and p.positions=position_groups) then return target_id;end if;
  raise exception 'Plan ID already exists with different data.';
 end if;
 insert into public.learning_plans(id,title,weeks,package_ids,ages,positions,created_by) values(target_id,trim(plan_title),week_count,packages,age_groups,position_groups,auth.uid());
 return target_id;
end$$;
create function public.learning_save_week(target_id uuid,target_plan uuid,week_no integer,week_title text,resource_ids uuid[],quizzes uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.learning_plans;snapshots jsonb;rev integer;
begin
 perform public.learning_require_staff();select * into strict p from public.learning_plans where id=target_plan;
 if p.created_by<>auth.uid() and public.current_account_role() not in ('owner','manager') then raise exception 'Plan is outside your authoring scope.';end if;
 if week_no<0 or week_no>p.weeks or cardinality(resource_ids)>24 or cardinality(quizzes)>8 or cardinality(resource_ids)+cardinality(quizzes)<1 or array_position(resource_ids,null) is not null or array_position(quizzes,null) is not null then raise exception 'Choose 1–24 lessons and at most 8 quizzes for this week.';end if;
 if (select count(distinct x) from unnest(resource_ids) x)<>cardinality(resource_ids) or (select count(distinct x) from unnest(quizzes) x)<>cardinality(quizzes) then raise exception 'Remove duplicate items.';end if;
 if exists(select 1 from unnest(resource_ids) rid left join public.training_resources r on r.id=rid where r.id is null or (r.created_by<>auth.uid() and public.current_account_role() not in ('owner','manager'))) then raise exception 'Choose resources in your authoring scope.';end if;
 if exists(select 1 from unnest(quizzes) qid left join public.learning_quiz_versions v on v.id=qid where v.id is null or (v.created_by<>auth.uid() and public.current_account_role() not in ('owner','manager'))) then raise exception 'Choose quiz versions in your authoring scope.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'content',r.content,'asset_path',r.asset_path,'asset_type',r.asset_type,'asset_name',r.asset_name) order by ord),'[]') into snapshots from unnest(resource_ids) with ordinality i(id,ord) join public.training_resources r on r.id=i.id;
 perform pg_advisory_xact_lock(hashtextextended(target_plan::text,1920));
 if exists(select 1 from public.learning_week_versions where id=target_id) then
  if exists(select 1 from public.learning_week_versions w where w.id=target_id and w.created_by=auth.uid() and w.plan_id=target_plan and w.week_number=week_no and w.title=trim(week_title) and w.resources=snapshots and w.quiz_version_ids=quizzes) then return target_id;end if;
  raise exception 'Week ID already exists with different data.';
 end if;
 select coalesce(max(revision),0)+1 into rev from public.learning_week_versions where plan_id=target_plan and week_number=week_no;
 insert into public.learning_week_versions(id,plan_id,week_number,revision,title,resources,quiz_version_ids,created_by) values(target_id,target_plan,week_no,rev,trim(week_title),snapshots,quizzes,auth.uid());
 return target_id;
end$$;
create function public.learning_week_ready(target_week uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_week_versions w where w.id=target_week and w.approved_at is not null and w.retracted_at is null
 and not exists(select 1 from jsonb_array_elements(w.resources) s where not exists(
 select 1 from public.training_resources r join storage.objects o on o.bucket_id='training-media' and o.name=r.asset_path
 where r.id=(s->>'id')::uuid and r.version=(s->>'version')::integer and r.status='published' and r.review_stage='approved'
 and r.asset_path=s->>'asset_path' and coalesce((o.metadata->>'size')::bigint,0)>0 and o.metadata->>'mimetype'=r.asset_type)))
$$;
create function public.learning_approve_week(target_week uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_staff();if public.current_account_role() not in ('owner','manager') then raise exception 'Owner or Manager approval is required.';end if;
 update public.learning_week_versions set approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()) where id=target_week;
 if not found then raise exception 'Week not found.';end if;
 if not public.learning_week_ready(target_week) then raise exception 'All lesson uploads must be complete, approved and unchanged.';end if;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'approve_week',target_week);
end$$;
create function public.learning_selected_week(target_enrollment uuid,week_no integer) returns uuid language sql stable security definer set search_path='' as $$
 select coalesce((select week_version_id from public.learning_week_overrides where enrollment_id=target_enrollment and week_number=week_no),
 (select w.id from public.learning_week_versions w join public.learning_enrollments e on e.plan_id=w.plan_id where e.id=target_enrollment and w.week_number=week_no and w.approved_at is not null order by w.revision desc limit 1))
$$;
create function public.learning_week_matches_profile(target_week uuid,target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_week_versions w join public.player_profiles p on p.id=target_profile where w.id=target_week
 and not exists(select 1 from jsonb_array_elements(w.resources) x where not coalesce((x->'content'->'ages') ? p.age_group,false)
 or (jsonb_array_length(x->'content'->'positions')>0 and not coalesce((x->'content'->'positions') ? p.position,false))
 or not coalesce((x->'content'->'levels') ? p.experience,false)))
$$;
create function public.learning_enroll(target_id uuid,target_profile uuid,target_plan uuid,orientation_now boolean default true) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.learning_enrollments;w uuid;
begin
 perform public.learning_require_owner();
 if not public.learning_profile_allowed(target_profile) or not public.learning_eligible(target_profile,target_plan,now()) then raise exception 'Athlete is outside scope or does not have verified active plan eligibility.';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,1921));
 select * into e from public.learning_enrollments where id=target_id;
 if found then if e.profile_id=target_profile and e.plan_id=target_plan then return e.id;end if;raise exception 'Enrollment ID already used.';end if;
 if exists(select 1 from public.learning_enrollments where profile_id=target_profile and state in ('active','paused')) then raise exception 'End the current enrollment before starting another; history is retained.';end if;
 insert into public.learning_enrollments(id,profile_id,plan_id,next_release_at,created_by) values(target_id,target_profile,target_plan,public.learning_next_sunday(now()),auth.uid());
 if orientation_now then
  w:=public.learning_selected_week(target_id,0);
  if public.learning_week_ready(w) and public.learning_week_matches_profile(w,target_profile) then insert into public.learning_releases(enrollment_id,sequence,week_number,week_version_id,scheduled_at) values(target_id,0,0,w,now());end if;
 end if;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'enroll',target_id);return target_id;
end$$;
create function public.learning_set_access(target_profile uuid,package_name text,starts timestamptz,ends timestamptz,reason_text text,revoke boolean default false) returns void
language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_owner();if not public.learning_profile_allowed(target_profile) then raise exception 'Athlete is outside scope.';end if;
 if package_name not in ('foundation','fundamentals','position-development','elite-coaching','private_test') then raise exception 'Choose a configured package ID.';end if;
 insert into public.learning_access(profile_id,package_id,starts_at,ends_at,reason,verified_by,revoked_at) values(target_profile,package_name,starts,ends,reason_text,auth.uid(),case when revoke then now() end)
 on conflict(profile_id) do update set package_id=excluded.package_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,reason=excluded.reason,verified_by=auth.uid(),revoked_at=excluded.revoked_at;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'verify_access',target_profile);
end$$;
create function public.learning_control(target_enrollment uuid,action_name text,expected_version integer,target_release uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare e public.learning_enrollments;r public.learning_releases;n integer;
begin
 perform public.learning_require_owner();select * into strict e from public.learning_enrollments where id=target_enrollment for update;
 if not public.learning_profile_allowed(e.profile_id) then raise exception 'Athlete is outside scope.';end if;
 if e.version<>expected_version then raise exception 'Enrollment changed. Refresh before saving.';end if;
 if action_name='pause' and e.state='active' then update public.learning_enrollments set state='paused',version=version+1 where id=e.id;
 elsif action_name='resume' and e.state='paused' then update public.learning_enrollments set state='active',next_release_at=public.learning_next_sunday(now()),version=version+1 where id=e.id;
 elsif action_name='end' and e.state in ('active','paused','finished') then update public.learning_enrollments set state='ended',ended_at=now(),version=version+1 where id=e.id;
 elsif action_name='repeat' and e.state in ('active','finished') then
  select * into strict r from public.learning_releases where id=target_release and enrollment_id=e.id;
  if not public.learning_eligible(e.profile_id,e.plan_id,now()) then raise exception 'Active eligibility is required.';end if;
  select coalesce(max(sequence),0)+1 into n from public.learning_releases where enrollment_id=e.id;
  insert into public.learning_releases(enrollment_id,sequence,week_number,week_version_id,scheduled_at,repeated_from) values(e.id,n,r.week_number,r.week_version_id,now(),r.id);
  update public.learning_enrollments set next_release_at=public.learning_next_sunday(now()),version=version+1 where id=e.id;
 else raise exception 'This enrollment cannot perform that action.';end if;
 if action_name in ('pause','end') then update public.learning_notices set resolved_at=now() where profile_id=e.profile_id and resolved_at is null;end if;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),action_name,e.id);return e.version+1;
end$$;
create function public.learning_set_override(target_enrollment uuid,week_no integer,target_week uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.learning_enrollments;begin
 perform public.learning_require_owner();select * into strict e from public.learning_enrollments where id=target_enrollment for update;
 if not public.learning_profile_allowed(e.profile_id) or week_no<e.next_week or not exists(select 1 from public.learning_week_versions where id=target_week and plan_id=e.plan_id and week_number=week_no and approved_at is not null) or not public.learning_week_ready(target_week) or not public.learning_week_matches_profile(target_week,e.profile_id) then raise exception 'Choose an approved future week in this plan.';end if;
 insert into public.learning_week_overrides values(e.id,week_no,target_week) on conflict(enrollment_id,week_number) do update set week_version_id=excluded.week_version_id;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'override_week',e.id);
end$$;
create function public.learning_save_cohort(target_id uuid,cohort_title text,profiles uuid[]) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_owner();if cardinality(profiles)>500 or exists(select 1 from unnest(profiles) p where not public.learning_profile_allowed(p)) then raise exception 'Choose at most 500 in-scope athletes.';end if;
 insert into public.learning_cohorts values(target_id,trim(cohort_title),auth.uid()) on conflict(id) do update set title=excluded.title;
 delete from public.learning_cohort_members where cohort_id=target_id;
 insert into public.learning_cohort_members select target_id,p from (select distinct unnest(profiles) p) s;
end$$;
create function public.learning_enroll_cohort(target_cohort uuid,target_plan uuid,operation_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare p uuid;n integer:=0;existing integer;begin
 perform public.learning_require_owner();perform pg_advisory_xact_lock(hashtextextended(operation_id::text,1922));
 select count(*) into existing from public.learning_audit where action='enroll_cohort' and target=operation_id;
 if existing>0 then
  if not exists(select 1 from public.learning_audit where action='enroll_cohort' and target=operation_id and detail->>'cohort'=target_cohort::text and detail->>'plan'=target_plan::text) then raise exception 'Group operation ID already used.';end if;
  return (select (detail->>'count')::integer from public.learning_audit where action='enroll_cohort' and target=operation_id limit 1);end if;
 for p in select profile_id from public.learning_cohort_members where cohort_id=target_cohort order by profile_id loop
  perform public.learning_enroll(gen_random_uuid(),p,target_plan,true);n:=n+1;
 end loop;
 if n=0 then raise exception 'Group has no athletes.';end if;
 insert into public.learning_audit(actor_id,action,target,detail) values(auth.uid(),'enroll_cohort',operation_id,jsonb_build_object('count',n,'cohort',target_cohort,'plan',target_plan));return n;
end$$;
create function public.learning_group_results(target_cohort uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform public.learning_require_staff();
 return coalesce((select jsonb_agg(jsonb_build_object('profile_id',p.id,'name',p.nickname,'releases',
 (select count(*) from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where e.profile_id=p.id),
 'completed_weeks',(select count(*) from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where e.profile_id=p.id and public.learning_release_done(r.id)),
 'quiz_attempts',coalesce((select jsonb_agg(jsonb_build_object('quiz',q.title,'week_number',r.week_number,'state',a.state,'submitted_at',a.submitted_at,'objective_points',a.objective_points,'total_points',v.total_points,'written_points',(select coalesce(sum((value#>>'{}')::numeric),0) from jsonb_each((select g.question_points from public.learning_quiz_grades g where g.attempt_id=a.id order by g.revision desc limit 1))))) from public.learning_enrollments e join public.learning_releases r on r.enrollment_id=e.id join public.learning_quiz_attempts a on a.release_id=r.id join public.learning_quiz_versions v on v.id=a.quiz_version_id join public.learning_quizzes q on q.id=v.quiz_id where e.profile_id=p.id),'[]')) order by p.nickname)
 from public.learning_cohort_members m join public.player_profiles p on p.id=m.profile_id where m.cohort_id=target_cohort and public.learning_profile_allowed(p.id) and public.staff_can_view_service_athlete(p.id)),'[]');
end$$;
create function public.learning_configure_rules(friday_clock time,ready_threshold integer) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_owner();
 update public.learning_settings set friday_time=friday_clock,low_ready_weeks=ready_threshold;
 insert into public.learning_audit(actor_id,action,detail) values(auth.uid(),'configure_learning_rules',jsonb_build_object('friday_time',friday_clock,'low_ready_weeks',ready_threshold));
end$$;
-- Shared authorization for release, quiz and completion endpoints. No guardian bypass.
create function public.learning_release_allowed(target_release uuid,require_access boolean default true) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=target_release and r.available_at<=now()
 and exists(select 1 from public.learning_week_versions w where w.id=r.week_version_id and w.retracted_at is null) and public.learning_profile_allowed(e.profile_id) and (not require_access or public.learning_eligible(e.profile_id,e.plan_id,now())))
$$;
create function public.learning_save_attempt(target_attempt uuid,target_release uuid,target_quiz uuid,responses jsonb,submit boolean,expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.learning_quiz_attempts;q jsonb;k jsonb;v public.learning_quiz_versions;answer jsonb;points integer:=0;manual boolean:=false;new_state text;w public.learning_week_versions;profile uuid;
begin
 if not public.learning_release_allowed(target_release) then raise exception 'This quiz is unavailable.';end if;
 select e.profile_id into profile from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=target_release;
 if not public.learning_can_submit(profile) then raise exception 'The parent has paused independent recording, or this athlete is outside your household.';end if;
 select wv.* into strict w from public.learning_releases r join public.learning_week_versions wv on wv.id=r.week_version_id where r.id=target_release;
 if not target_quiz=any(w.quiz_version_ids) then raise exception 'Quiz is not assigned in this release.';end if;
 if jsonb_typeof(responses)<>'object' or octet_length(responses::text)>220000 then raise exception 'Invalid answer data.';end if;
 select * into strict v from public.learning_quiz_versions where id=target_quiz;
 if exists(select 1 from jsonb_object_keys(responses) x where not exists(select 1 from jsonb_array_elements(v.questions) candidate where candidate->>'id'=x)) then raise exception 'Unknown question.';end if;
 for q in select value from jsonb_array_elements(v.questions) loop
  answer:=responses->(q->>'id');
  if answer is not null and answer<>'null'::jsonb then
   if q->>'type'='written' then if jsonb_typeof(answer)<>'string' or length(answer#>>'{}')>2000 then raise exception 'Written answers must be at most 2000 characters.';end if;
   elsif jsonb_typeof(answer)<>'number' or (answer#>>'{}')::numeric<>trunc((answer#>>'{}')::numeric) or (answer#>>'{}')::integer not between 0 and jsonb_array_length(q->'options')-1 then raise exception 'Choose a valid answer.';end if;
  end if;
  if submit and (answer is null or answer='null'::jsonb or (q->>'type'='written' and length(trim(answer#>>'{}'))=0)) then raise exception 'Answer every question before submitting.';end if;
  if q->>'type'='written' then manual:=true;
  elsif submit then select value into strict k from public.learning_quiz_keys t cross join jsonb_array_elements(t.keys) where t.version_id=v.id and value->>'id'=q->>'id';
   if answer=k->'correct' then points:=points+(q->>'points')::integer;end if;
  end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(target_attempt::text,1923));
 select * into a from public.learning_quiz_attempts where id=target_attempt for update;
 if found then
  if a.actor_id<>auth.uid() or a.release_id<>target_release or a.quiz_version_id<>target_quiz then raise exception 'Attempt is outside your scope.';end if;
  if a.state<>'draft' then if submit and a.answers=responses then return jsonb_build_object('id',a.id,'state',a.state,'version',a.version,'objective_points',a.objective_points);end if;raise exception 'Submitted answers cannot be edited. Start a new attempt.';end if;
  if not submit and a.answers=responses then return jsonb_build_object('id',a.id,'state',a.state,'version',a.version,'objective_points',a.objective_points);end if;
  if a.version<>expected_version then raise exception 'Answers changed on another device. Reload before saving.';end if;
 else
  if expected_version<>0 then raise exception 'Attempt not found. Reload before saving.';end if;
  if (select count(*) from public.learning_quiz_attempts where release_id=target_release and quiz_version_id=target_quiz and actor_id=auth.uid())>=10 then raise exception 'Ten attempts are retained. Ask staff before another retry.';end if;
 end if;
 new_state:=case when not submit then 'draft' when manual then 'needs_grading' else 'graded' end;
 insert into public.learning_quiz_attempts(id,release_id,quiz_version_id,actor_id,answers,state,objective_points,submitted_at) values(target_attempt,target_release,target_quiz,auth.uid(),responses,new_state,case when submit then points end,case when submit then now() end)
 on conflict(id) do update set answers=excluded.answers,state=excluded.state,objective_points=excluded.objective_points,submitted_at=excluded.submitted_at,version=learning_quiz_attempts.version+1 returning * into a;
 return jsonb_build_object('id',a.id,'state',a.state,'version',a.version,'objective_points',a.objective_points);
end$$;
create function public.learning_grade_written(target_attempt uuid,marks jsonb,feedback_text text,expected_revision integer) returns integer language plpgsql security definer set search_path='' as $$
declare a public.learning_quiz_attempts;v public.learning_quiz_versions;q jsonb;n integer;profile uuid;begin
 perform public.learning_require_staff();select * into strict a from public.learning_quiz_attempts where id=target_attempt for update;
 select e.profile_id into profile from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=a.release_id;
 if not public.learning_profile_allowed(profile) or not public.staff_can_view_service_athlete(profile) or a.state='draft' then raise exception 'Attempt is outside your grading scope.';end if;
 select * into strict v from public.learning_quiz_versions where id=a.quiz_version_id;
 select coalesce(max(revision),0) into n from public.learning_quiz_grades where attempt_id=a.id;
 if n<>expected_revision then raise exception 'Grade changed. Refresh before saving.';end if;
 if jsonb_typeof(marks)<>'object' or exists(select 1 from jsonb_object_keys(marks) x where not exists(select 1 from jsonb_array_elements(v.questions) candidate where candidate->>'id'=x and candidate->>'type'='written')) then raise exception 'Grade written questions only.';end if;
 for q in select value from jsonb_array_elements(v.questions) where value->>'type'='written' loop
  if marks->(q->>'id') is null or jsonb_typeof(marks->(q->>'id'))<>'number' or (marks->>(q->>'id'))::numeric<0 or (marks->>(q->>'id'))::numeric>(q->>'points')::numeric then raise exception 'Grade every written question within its points.';end if;
 end loop;
 insert into public.learning_quiz_grades(attempt_id,revision,question_points,feedback,graded_by) values(a.id,n+1,marks,feedback_text,auth.uid());
 update public.learning_quiz_attempts set state='graded' where id=a.id;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'grade_written',a.id);return n+1;
end$$;
create function public.learning_complete(target_release uuid,item text) returns void language plpgsql security definer set search_path='' as $$
declare profile uuid;begin
 if not public.learning_release_allowed(target_release) then raise exception 'This release is unavailable.';end if;
 select e.profile_id into profile from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=target_release;
 if not public.learning_can_submit(profile) then raise exception 'The parent has paused independent recording, or this athlete is outside your household.';end if;
 if not exists(select 1 from public.learning_releases r join public.learning_week_versions w on w.id=r.week_version_id cross join jsonb_array_elements(w.resources) x where r.id=target_release and x->>'id'=item) then raise exception 'Lesson is not assigned in this release.';end if;
 insert into public.learning_completion(release_id,item_id,reported_by,status,reviewed_by,reviewed_at) select target_release,item,auth.uid(),case when a.account_type='parent' and p.owner_id=auth.uid() then 'approved' when a.account_type='parent' then 'pending_parent' else 'self_reported' end,case when p.owner_id=auth.uid() and a.account_type='parent' then auth.uid() end,case when p.owner_id=auth.uid() and a.account_type='parent' then now() end from public.player_profiles p join public.member_accounts a on a.user_id=p.owner_id where p.id=profile
 on conflict(release_id,item_id) do update set status=excluded.status,reported_by=excluded.reported_by,completed_at=now(),version=learning_completion.version+1 where learning_completion.status='needs_repeat';
end$$;
create function public.learning_review_completion(target_release uuid,item text,decision text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare c public.learning_completion;begin
 if decision is null or decision not in ('approved','needs_repeat') then raise exception 'Choose a parent review decision.';end if;
 if not public.learning_release_allowed(target_release,false) or not exists(select 1 from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id join public.player_profiles p on p.id=e.profile_id join public.member_accounts a on a.user_id=p.owner_id where r.id=target_release and p.owner_id=auth.uid() and a.account_type='parent') then raise exception 'Only this athlete’s parent can review practice.';end if;
 select * into strict c from public.learning_completion where release_id=target_release and item_id=item for update;
 if c.version<>expected_version or c.status<>'pending_parent' then raise exception 'Practice review changed. Reload before reviewing.';end if;
 update public.learning_completion set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),version=version+1 where release_id=target_release and item_id=item;
 insert into public.learning_audit(actor_id,action,target,detail) values(auth.uid(),'parent_practice_review',target_release,jsonb_build_object('item',item,'decision',decision,'version',expected_version+1));
end$$;
create function public.learning_release_done(target_release uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_releases r join public.learning_week_versions w on w.id=r.week_version_id where r.id=target_release
 and not exists(select 1 from jsonb_array_elements(w.resources) x where not exists(select 1 from public.learning_completion c where c.release_id=r.id and c.item_id=x->>'id' and c.status<>'needs_repeat'))
 and not exists(select 1 from unnest(w.quiz_version_ids) q where not exists(select 1 from public.learning_quiz_attempts a where a.release_id=r.id and a.quiz_version_id=q and a.submitted_at is not null)))
$$;
-- Scheduler entry is service-role only, disabled by default, dry-run supported.
-- Late invocation releases ONE week; it never dumps a backlog on an athlete.
create function public.learning_tick(at_time timestamptz default now(),dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.learning_enrollments;w uuid;seq integer;count_release integer:=0;count_reminder integer:=0;count_low integer:=0;ready integer;next_no integer;last_r public.learning_releases;local_now timestamp;due timestamp;settings public.learning_settings;cat text;failed integer:=0;prior_release integer;prior_reminder integer;prior_low integer;
begin
 select * into settings from public.learning_settings;
 if not settings.enabled or (not dry_run and not settings.scheduler_enabled) then return jsonb_build_object('disabled',true);end if;
 local_now:=at_time at time zone 'America/Chicago';
 for e in select * from public.learning_enrollments where state in ('active','finished') order by id for update skip locked loop
  prior_release:=count_release;prior_reminder:=count_reminder;prior_low:=count_low;begin
  if not public.learning_eligible(e.profile_id,e.plan_id,at_time) or (not settings.youth_enabled and exists(select 1 from public.player_profiles p where p.id=e.profile_id and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)))) then continue;end if;
  if e.state='active' and e.next_release_at<=at_time then
   w:=public.learning_selected_week(e.id,e.next_week);
   if public.learning_week_ready(w) and public.learning_week_matches_profile(w,e.profile_id) then
    count_release:=count_release+1;
    if not dry_run then
     select coalesce(max(sequence),0)+1 into seq from public.learning_releases where enrollment_id=e.id;
     insert into public.learning_releases(enrollment_id,sequence,week_number,week_version_id,scheduled_at,available_at) values(e.id,seq,e.next_week,w,e.next_release_at,at_time) returning * into last_r;
     update public.learning_enrollments set next_week=next_week+1,next_release_at=public.learning_next_sunday(at_time),version=version+1,state=case when next_week>=(select weeks from public.learning_plans where id=e.plan_id) then 'finished' else state end where id=e.id;
     if settings.notices_enabled then insert into public.learning_notices(event_key,profile_id,release_id,category,staff_only) values('ready:'||last_r.id,e.profile_id,last_r.id,'content_ready',false) on conflict do nothing;end if;
    end if;
   end if;
  end if;
  select * into last_r from public.learning_releases where enrollment_id=e.id order by sequence desc limit 1;
  due:=(date_trunc('week',local_now+interval '1 day')-interval '1 day'+interval '5 days')::date+settings.friday_time;
  if extract(dow from local_now)=5 and local_now>=due and last_r.id is not null and last_r.available_at at time zone 'America/Chicago'<due and not public.learning_release_done(last_r.id) then
   if not exists(select 1 from public.learning_notices where event_key='friday:'||last_r.id||':'||local_now::date) then
    count_reminder:=count_reminder+1;
    if not dry_run and settings.notices_enabled then insert into public.learning_notices(event_key,profile_id,release_id,category,staff_only) values('friday:'||last_r.id||':'||local_now::date,e.profile_id,last_r.id,'friday_incomplete',false) on conflict do nothing;end if;
   end if;
  end if;
  select next_week into next_no from public.learning_enrollments where id=e.id;
  ready:=0;
  while next_no+ready<=(select weeks from public.learning_plans where id=e.plan_id) and public.learning_week_ready(public.learning_selected_week(e.id,next_no+ready)) and public.learning_week_matches_profile(public.learning_selected_week(e.id,next_no+ready),e.profile_id) loop ready:=ready+1;end loop;
  cat:=case when ready=0 then 'no_content' else 'low_content' end;
  if next_no<=(select weeks from public.learning_plans where id=e.plan_id) and ready<settings.low_ready_weeks then
   count_low:=count_low+1;
   if not dry_run and settings.notices_enabled then
    delete from public.learning_notice_reads rr using public.learning_notices n where rr.notice_id=n.id and n.event_key='capacity:'||e.id||':'||next_no||':'||cat and n.resolved_at is not null;
    insert into public.learning_notices(event_key,profile_id,category,staff_only,created_at) values('capacity:'||e.id||':'||next_no||':'||cat,e.profile_id,cat,true,at_time) on conflict(event_key) do update set resolved_at=null,created_at=case when learning_notices.resolved_at is not null then excluded.created_at else learning_notices.created_at end;
    update public.learning_notices set resolved_at=at_time where profile_id=e.profile_id and category in ('no_content','low_content') and resolved_at is null and event_key<>'capacity:'||e.id||':'||next_no||':'||cat;
   end if;
  elsif not dry_run then update public.learning_notices set resolved_at=at_time where profile_id=e.profile_id and category in ('no_content','low_content') and resolved_at is null;end if;
 exception when others then
  count_release:=prior_release;count_reminder:=prior_reminder;count_low:=prior_low;
  failed:=failed+1;
  if not dry_run then
   insert into public.learning_audit(action,target,detail) values('release_tick_failed',e.id,jsonb_build_object('sqlstate',sqlstate));
   if settings.notices_enabled then insert into public.learning_notices(event_key,profile_id,category,staff_only) values('tick_failed:'||e.id||':'||(at_time at time zone 'America/Chicago')::date,e.profile_id,'no_content',true) on conflict do nothing;end if;
  end if;
 end;end loop;
 if not dry_run then
  update public.learning_notices n set resolved_at=at_time where n.category='friday_incomplete' and n.resolved_at is null and (public.learning_release_done(n.release_id) or not exists(select 1 from public.learning_releases r join public.learning_enrollments current_enrollment on current_enrollment.id=r.enrollment_id where r.id=n.release_id and current_enrollment.state in ('active','finished') and public.learning_eligible(current_enrollment.profile_id,current_enrollment.plan_id,at_time) and r.sequence=(select max(latest.sequence) from public.learning_releases latest where latest.enrollment_id=current_enrollment.id)));
 end if;
 return jsonb_build_object('dry_run',dry_run,'releases',count_release,'reminders',count_reminder,'low_content',count_low,'failed_enrollments',failed,'timezone','America/Chicago');
end$$;
create function public.learning_athlete(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not public.learning_profile_allowed(target_profile) then raise exception 'Athlete is outside your learning scope.';end if;
 select jsonb_build_object('can_submit',public.learning_can_submit(target_profile),'is_guardian',exists(select 1 from public.player_profiles p join public.member_accounts a on a.user_id=p.owner_id where p.id=target_profile and p.owner_id=auth.uid() and a.account_type='parent'),'enrollments',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'plan_id',e.plan_id,'title',p.title,'state',e.state,'next_week',e.next_week,'next_release_at',e.next_release_at,'version',e.version,'access_active',public.learning_eligible(e.profile_id,e.plan_id,now()),'releases',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'sequence',r.sequence,'week_number',r.week_number,'title',w.title,'available_at',r.available_at,'scheduled_at',r.scheduled_at,'content_blocked',w.retracted_at is not null,'done',public.learning_release_done(r.id),
 'resources',case when public.learning_eligible(e.profile_id,e.plan_id,now()) and w.retracted_at is null then w.resources else '[]'::jsonb end,
 'quizzes',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'title',s.title,'total_points',q.total_points,'questions',case when (public.learning_eligible(e.profile_id,e.plan_id,now()) or public.staff_can_view_service_athlete(e.profile_id)) and w.retracted_at is null then q.questions else '[]'::jsonb end)) from unnest(w.quiz_version_ids) x join public.learning_quiz_versions q on q.id=x join public.learning_quizzes s on s.id=q.quiz_id),'[]'),
 'completion_reviews',coalesce((select jsonb_agg(jsonb_build_object('item_id',c.item_id,'status',c.status,'version',c.version,'completed_at',c.completed_at,'reviewed_at',c.reviewed_at)) from public.learning_completion c where c.release_id=r.id),'[]'),'completed_items',coalesce((select jsonb_agg(item_id) from public.learning_completion c where c.release_id=r.id and c.status<>'needs_repeat'),'[]'),
 'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'quiz_version_id',a.quiz_version_id,'actor_id',a.actor_id,'answers',a.answers,'state',a.state,'objective_points',a.objective_points,'submitted_at',a.submitted_at,'version',a.version,'grades',coalesce((select jsonb_agg(jsonb_build_object('revision',g.revision,'points',g.question_points,'feedback',g.feedback,'graded_at',g.graded_at) order by revision) from public.learning_quiz_grades g where g.attempt_id=a.id),'[]'))) from public.learning_quiz_attempts a where a.release_id=r.id),'[]')) order by r.sequence desc) from public.learning_releases r join public.learning_week_versions w on w.id=r.week_version_id where r.enrollment_id=e.id),'[]')) order by e.created_at desc) from public.learning_enrollments e join public.learning_plans p on p.id=e.plan_id where e.profile_id=target_profile),'[]')) into result;
 return result;
end$$;
create function public.learning_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform public.learning_require_staff();return jsonb_build_object('plans',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('weeks_content',coalesce((select jsonb_agg(to_jsonb(w)||jsonb_build_object('ready',public.learning_week_ready(w.id)) order by week_number,revision desc) from public.learning_week_versions w where w.plan_id=p.id),'[]'))) from public.learning_plans p where p.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'quizzes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'quiz_id',v.quiz_id,'title',q.title,'revision',v.revision,'questions',v.questions,'keys',k.keys,'total_points',v.total_points)) from public.learning_quiz_versions v join public.learning_quizzes q on q.id=v.quiz_id join public.learning_quiz_keys k on k.version_id=v.id where v.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'rules',(select jsonb_build_object('friday_time',friday_time::text,'low_ready_weeks',low_ready_weeks) from public.learning_settings),'cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'profiles',coalesce((select jsonb_agg(m.profile_id) from public.learning_cohort_members m where m.cohort_id=c.id and public.learning_profile_allowed(m.profile_id)),'[]'))) from public.learning_cohorts c where public.current_account_role() in ('owner','manager') or exists(select 1 from public.learning_cohort_members m where m.cohort_id=c.id and public.staff_can_view_service_athlete(m.profile_id))),'[]'));
end$$;
create function public.learning_inbox() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'profile_id',n.profile_id,'release_id',n.release_id,'category',n.category,'created_at',n.created_at,'read',exists(select 1 from public.learning_notice_reads r where r.notice_id=n.id and r.user_id=auth.uid())) order by n.created_at desc),'[]')
 from public.learning_notices n where n.resolved_at is null and public.learning_profile_allowed(n.profile_id) and ((n.staff_only and public.staff_can_view_service_athlete(n.profile_id) and exists(select 1 from public.learning_enrollments e where e.profile_id=n.profile_id and e.state='active' and public.learning_eligible(e.profile_id,e.plan_id,now())))
 or (not n.staff_only and public.can_view_athlete(n.profile_id) and exists(select 1 from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=n.release_id and public.learning_eligible(e.profile_id,e.plan_id,now()) and (n.category<>'friday_incomplete' or (e.state in ('active','finished') and public.learning_can_submit(e.profile_id) and r.sequence=(select max(latest.sequence) from public.learning_releases latest where latest.enrollment_id=e.id))))))
$$;
create function public.learning_read_notice(target_notice uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from jsonb_array_elements(public.learning_inbox()) x where x->>'id'=target_notice::text) then raise exception 'Notice is outside your scope.';end if;
 insert into public.learning_notice_reads values(target_notice,auth.uid(),now()) on conflict do nothing;
end$$;
create function public.learning_retract_week(target_week uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_staff();if public.current_account_role() not in ('owner','manager') then raise exception 'Owner or Manager access is required.';end if;
 update public.learning_week_versions set retracted_at=coalesce(retracted_at,now()) where id=target_week;
 if not found then raise exception 'Week not found.';end if;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'retract_week',target_week);
end$$;
alter function public.account_closure_reason(uuid) rename to account_closure_reason_before_learning;
revoke all on function public.account_closure_reason_before_learning(uuid) from public,anon,authenticated;
create function public.account_closure_reason(target uuid) returns text language sql stable security definer set search_path='' as $$
 select case when public.account_closure_reason_before_learning(target)<>'' then public.account_closure_reason_before_learning(target)
 when exists(select 1 from public.learning_quizzes where created_by=target) or exists(select 1 from public.learning_plans where created_by=target) then 'staff_content' else '' end
$$;
revoke all on function public.account_closure_reason(uuid) from public,anon,authenticated;
-- Explicit RPC grants: internal helpers and tick are never public-callable.
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'learning_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;end$$;
grant execute on function public.learning_import_quiz(uuid,uuid,text,jsonb),public.learning_create_plan(uuid,text,integer,text[],text[],text[]),public.learning_save_week(uuid,uuid,integer,text,uuid[],uuid[]),public.learning_approve_week(uuid),public.learning_enroll(uuid,uuid,uuid,boolean),public.learning_set_access(uuid,text,timestamptz,timestamptz,text,boolean),public.learning_control(uuid,text,integer,uuid),public.learning_set_override(uuid,integer,uuid),public.learning_save_cohort(uuid,text,uuid[]),public.learning_enroll_cohort(uuid,uuid,uuid),public.learning_save_attempt(uuid,uuid,uuid,jsonb,boolean,integer),public.learning_grade_written(uuid,jsonb,text,integer),public.learning_complete(uuid,text),public.learning_review_completion(uuid,text,text,integer),public.learning_athlete(uuid),public.learning_catalog(),public.learning_inbox(),public.learning_read_notice(uuid),public.learning_retract_week(uuid),public.learning_configure_rules(time,integer),public.learning_group_results(uuid) to authenticated;
grant execute on function public.learning_tick(timestamptz,boolean) to service_role;

-- SOURCE 020-learning-media-retention.sql SHA256 27d67b3c989136eef63b247e12a5a88a4a49d5d01383671288c2a43d956cdcd5
-- REVIEW DRAFT: storage-policy change, requires separate production approval.
-- Retains existing original media referenced by approved learning snapshots.
-- No bucket, quota increase, deletion job or migration of existing files.
create function public.learning_media_retained(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_week_versions w cross join jsonb_array_elements(w.resources) x where w.approved_at is not null and x->>'asset_path'=path)
$$;
create function public.learning_media_allowed(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_releases r join public.learning_week_versions w on w.id=r.week_version_id cross join jsonb_array_elements(w.resources) x where x->>'asset_path'=path and public.learning_release_allowed(r.id,true))
$$;
revoke all on function public.learning_media_retained(text),public.learning_media_allowed(text) from public,anon;
grant execute on function public.learning_media_retained(text),public.learning_media_allowed(text) to authenticated;
create policy "Read active released learning media" on storage.objects for select to authenticated using(bucket_id='training-media' and public.learning_media_allowed(name));
create policy "Retain approved learning snapshot media" on storage.objects as restrictive for delete to authenticated using(bucket_id<>'training-media' or not public.learning_media_retained(name));
-- Prevent replacing bytes at the same retained path through any future UPSERT policy.
create policy "Do not overwrite approved learning media" on storage.objects as restrictive for update to authenticated using(bucket_id<>'training-media' or not public.learning_media_retained(name)) with check(bucket_id<>'training-media' or not public.learning_media_retained(name));

-- SOURCE 021-learning-service-workflows.sql SHA256 21fa42d9b70fe73ebf17dd77aa3e291b5ddf0a807c588b06a60b776401ff27f7
-- DRAFT, not installed. Requires 019/020. No flags, cron or roles are activated.
create index learning_enrollment_profile_history on public.learning_enrollments(profile_id,created_at desc,id);
create index learning_attempt_review_state on public.learning_quiz_attempts(state,release_id);
create index learning_notice_profile_state on public.learning_notices(profile_id,resolved_at,category);
create index learning_cohort_profile on public.learning_cohort_members(profile_id,cohort_id);
create function public.learning_search(value text) returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(normalize(coalesce(value,''),NFKD),U&'[\0300-\036f]','','g'))
$$;
create function public.learning_staff_summary(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.learning_enrollments;p public.learning_plans;r public.learning_releases;w public.learning_week_versions;ready integer:=0;pending_grades integer;pending_parent integer;summary_state text;active_access boolean;last_report timestamptz;
begin
 perform public.learning_require_staff();if not public.staff_can_view_service_athlete(target_profile) then raise exception 'Athlete is outside your service roster.';end if;
 select * into e from public.learning_enrollments where profile_id=target_profile and state in ('active','paused','finished') order by created_at desc,id desc limit 1;
 select count(*)::integer into pending_grades from public.learning_quiz_attempts a join public.learning_releases lr on lr.id=a.release_id join public.learning_enrollments le on le.id=lr.enrollment_id where le.profile_id=target_profile and a.state='needs_grading';
 select count(*)::integer into pending_parent from public.learning_completion c join public.learning_releases lr on lr.id=c.release_id join public.learning_enrollments le on le.id=lr.enrollment_id where le.profile_id=target_profile and c.status='pending_parent';
 if e.id is null then return jsonb_build_object('enabled',true,'status',case when pending_grades>0 then 'needs_grading' when pending_parent>0 then 'pending_parent' else 'not_enrolled' end,'title',null,'enrollment_id',null,'ready_weeks',0,'pending_grades',pending_grades,'pending_parent',pending_parent);end if;
 select * into strict p from public.learning_plans where id=e.plan_id;
 select * into r from public.learning_releases where enrollment_id=e.id order by sequence desc limit 1;
 select * into w from public.learning_week_versions where id=r.week_version_id;
 active_access:=public.learning_eligible(target_profile,e.plan_id,now());
 while e.next_week+ready<=p.weeks and public.learning_week_ready(public.learning_selected_week(e.id,e.next_week+ready)) and public.learning_week_matches_profile(public.learning_selected_week(e.id,e.next_week+ready),target_profile) loop ready:=ready+1;end loop;
 select max(at_time) into last_report from (select a.submitted_at at_time from public.learning_quiz_attempts a join public.learning_releases lr on lr.id=a.release_id where lr.enrollment_id=e.id union all select c.completed_at from public.learning_completion c join public.learning_releases lr on lr.id=c.release_id where lr.enrollment_id=e.id) reports;
 summary_state:=case when not active_access then 'access_inactive' when e.state='paused' then 'paused' when pending_grades>0 then 'needs_grading' when pending_parent>0 then 'pending_parent' when w.retracted_at is not null then 'content_withdrawn' when e.state='active' and e.next_week<=p.weeks and ready=0 then 'needs_content' when r.id is null then 'awaiting_release' when public.learning_release_done(r.id) then case when e.state='finished' then 'plan_complete' else 'week_complete' end else 'ready' end;
 return jsonb_build_object('enabled',true,'enrollment_id',e.id,'plan_id',p.id,'title',p.title,'status',summary_state,'enrollment_state',e.state,'access_active',active_access,'current_week',r.week_number,'current_title',w.title,'current_release_id',r.id,'available_at',r.available_at,'scheduled_at',r.scheduled_at,'next_week',e.next_week,'next_release_at',case when e.state='active' then e.next_release_at end,'ready_weeks',ready,'total_weeks',p.weeks,'pending_grades',pending_grades,'pending_parent',pending_parent,'last_reported_at',last_report);
end$$;
-- Preserve the legacy source for advanced single-workout controls; new weekly
-- summary does not pretend a plan enrollment is a saved workout assignment.
alter function public.staff_athlete_service(uuid) rename to staff_athlete_service_before_learning;
revoke all on function public.staff_athlete_service_before_learning(uuid) from public,anon,authenticated;
create function public.staff_athlete_service(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;summary jsonb;next_step text;begin
 result:=public.staff_athlete_service_before_learning(target_profile);
 if not exists(select 1 from public.learning_settings where enabled) then return result;end if;
 summary:=public.learning_staff_summary(target_profile);
 next_step:=case when (result->>'overdue_reviews')::integer>0 then 'Follow up overdue review' when (result->>'blocked_reviews')::integer>0 then 'Resolve review follow-up' when result->>'coach_id' is null then 'Assign service coach'
 when summary->>'status'='not_enrolled' then 'Start a weekly plan' when summary->>'status'='access_inactive' then 'Review package eligibility' when summary->>'status'='paused' then 'Review paused plan' when summary->>'status'='needs_grading' then 'Grade written quiz answers' when summary->>'status'='pending_parent' then 'View parent practice review' when summary->>'status'='content_withdrawn' then 'Resolve withdrawn content' when summary->>'status'='needs_content' then 'Prepare the next week' when summary->>'status'='awaiting_release' then 'Review scheduled first week' when summary->>'status'='plan_complete' then 'Review completed plan' else 'View weekly training' end;
 return result||jsonb_build_object('learning',summary,'next_action',next_step);
end$$;
-- Keyset pagination: queries apply scope/search/status before bounded details.
-- Contact email is returned only in the same Owner/Manager scope as migration015.
create function public.staff_learning_roster_page(search_text text default '',status_filter text default 'all',age_filter text default '',position_filter text default '',coach_filter text default '',after_cursor jsonb default null,page_size integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor_role text;result jsonb;begin
 perform public.learning_require_staff();actor_role:=public.current_account_role();
 if search_text is null or length(search_text)>160 or status_filter is null or status_filter not in ('all','overdue','blocked','ready','unassigned') or page_size is null or page_size not between 1 and 100 then raise exception 'Choose valid roster filters and a page size from 1 to 100.';end if;
 if after_cursor is not null and (jsonb_typeof(after_cursor)<>'object' or not(after_cursor ?& array['priority','label','key']) or (after_cursor->>'priority')::integer not between 0 and 2 or length(after_cursor->>'label')>400 or length(after_cursor->>'key')>40) then raise exception 'Invalid roster cursor. Reset the list.';end if;
 with scoped as materialized (
 select a.user_id client_id,p.id profile_id,p.nickname,p.age_group,p.position,ac.coach_id,
 case when actor_role in ('owner','manager') then u.email else 'Client '||left(a.user_id::text,8) end client_label,
 cu.email coach_label,public.learning_search(coalesce(p.nickname,u.email)) label,case when p.id is null then 'c:'||a.user_id else 'p:'||p.id end row_key
 from public.member_accounts a join auth.users u on u.id=a.user_id join public.account_roles ar on ar.user_id=a.user_id
 left join public.player_profiles p on p.owner_id=a.user_id left join public.athlete_service_coaches ac on ac.profile_id=p.id left join auth.users cu on cu.id=ac.coach_id
 where ar.role in ('parent','athlete') and not public.account_is_closing(a.user_id)
 and ((actor_role in ('owner','manager') and (p.id is null or public.staff_can_view_service_athlete(p.id))) or (actor_role='coach' and p.id is not null and public.staff_can_view_service_athlete(p.id)))
 ), searched as materialized (
 select * from scoped s where (age_filter='' or s.age_group=age_filter) and (position_filter='' or s.position=position_filter) and (coach_filter='' or (coach_filter='none' and s.coach_id is null) or s.coach_id::text=coach_filter)
 and not exists(select 1 from regexp_split_to_table(public.learning_search(search_text),'\s+') word where word<>'' and strpos(public.learning_search(concat_ws(' ',s.nickname,s.client_label,s.position,s.coach_label)),word)=0)
 ), light as materialized (
 select s.*,case when s.profile_id is null then null else public.learning_staff_summary(s.profile_id) end learning,
 (select count(*) from public.review_services rs where rs.profile_id=s.profile_id and rs.state not in ('delivered','cancelled') and rs.due_at<=now() and (actor_role in ('owner','manager') or rs.assigned_to=auth.uid())) overdue,
 (select count(*) from public.review_services rs where rs.profile_id=s.profile_id and rs.state not in ('delivered','cancelled') and rs.blocker<>'none' and (actor_role in ('owner','manager') or rs.assigned_to=auth.uid())) blocked
 from searched s
 ), ranked as materialized (
 select l.*,case when overdue>0 then 0 when profile_id is null or coach_id is null or blocked>0 or learning->>'status' not in ('ready','week_complete','plan_complete','awaiting_release') then 1 else 2 end priority from light l
 ), matched as materialized (
 select * from ranked where status_filter='all' or (status_filter='overdue' and priority=0) or (status_filter='blocked' and priority=1) or (status_filter='ready' and priority=2) or (status_filter='unassigned' and coach_id is null)
 ), bounded as materialized (
 select * from matched where after_cursor is null or (priority,label collate "C",row_key) > ((after_cursor->>'priority')::integer,(after_cursor->>'label') collate "C",after_cursor->>'key') order by priority,label collate "C",row_key limit page_size+1
 ), displayed as materialized (select * from bounded order by priority,label collate "C",row_key limit page_size)
 select jsonb_build_object('source','account_backend','scope',case when actor_role='coach' then 'assigned_athletes' else 'all_repformed_clients' end,
 'rows',coalesce((select jsonb_agg(case when d.profile_id is null then jsonb_build_object('client_id',d.client_id,'client_label',d.client_label,'athlete_id',null,'athlete_name',null,'next_action','Complete private athlete setup') else public.staff_athlete_service(d.profile_id) end order by d.priority,d.label collate "C",d.row_key) from displayed d),'[]'),
 'coaches',case when actor_role in ('owner','manager') then coalesce((select jsonb_agg(jsonb_build_object('id',ar.user_id,'label',u.email) order by u.email) from public.account_roles ar join auth.users u on u.id=ar.user_id where ar.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(ar.user_id)),'[]') else coalesce((select jsonb_agg(jsonb_build_object('id',c.coach_id,'label',c.coach_label) order by c.coach_label) from (select distinct coach_id,coach_label from scoped where coach_id is not null) c),'[]') end,
 'page',jsonb_build_object('total',(select count(*) from ranked),'matched',(select count(*) from matched),'athletes',(select count(*) from scoped where profile_id is not null),'clients',(select count(distinct client_id) from scoped),
 'counts',jsonb_build_object('overdue',(select count(*) from ranked where priority=0),'attention',(select count(*) from ranked where priority=1),'ready',(select count(*) from ranked where priority=2)),
 'ages',coalesce((select jsonb_agg(age_group order by age_group) from (select distinct age_group from scoped where age_group is not null) a),'[]'),'positions',coalesce((select jsonb_agg(position order by position) from (select distinct position from scoped where position is not null) p),'[]'),
 'next_cursor',case when (select count(*) from bounded)>page_size then (select jsonb_build_object('priority',priority,'label',label,'key',row_key) from displayed order by priority desc,label collate "C" desc,row_key desc limit 1) end)) into result;
 return result;
end$$;
revoke all on function public.learning_search(text),public.learning_staff_summary(uuid),public.staff_athlete_service(uuid),public.staff_learning_roster_page(text,text,text,text,text,jsonb,integer) from public,anon;
grant execute on function public.staff_athlete_service(uuid),public.staff_learning_roster_page(text,text,text,text,text,jsonb,integer) to authenticated;
create or replace function public.learning_save_cohort(target_id uuid,cohort_title text,profiles uuid[]) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_owner();perform pg_advisory_xact_lock(hashtextextended(target_id::text,2121));if cardinality(profiles)>500 or exists(select 1 from unnest(profiles) p where not public.learning_profile_allowed(p)) then raise exception 'Choose at most 500 in-scope athletes.';end if;
 insert into public.learning_cohorts values(target_id,trim(cohort_title),auth.uid()) on conflict(id) do update set title=excluded.title;
 delete from public.learning_cohort_members where cohort_id=target_id;
 insert into public.learning_cohort_members select target_id,p from (select distinct unnest(profiles) p) s;
end$$;
create function public.learning_group_enrollment_preview(target_cohort uuid,target_plan uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p uuid;current_plan uuid;status text;rows jsonb:='[]';new_count integer:=0;kept integer:=0;blocked integer:=0;label text;
begin
 perform public.learning_require_owner();if not exists(select 1 from public.learning_plans where id=target_plan) then raise exception 'Choose a plan.';end if;
 for p in select profile_id from public.learning_cohort_members where cohort_id=target_cohort order by profile_id loop
  if not public.learning_profile_allowed(p) then status:='unavailable';label:='Unavailable athlete';blocked:=blocked+1;
  else
   select nickname into label from public.player_profiles where id=p;
   select plan_id into current_plan from public.learning_enrollments where profile_id=p and state in ('active','paused','finished') order by created_at desc,id desc limit 1;
   if current_plan=target_plan then status:='keep_existing';kept:=kept+1;
   elsif exists(select 1 from public.learning_enrollments where profile_id=p and state in ('active','paused')) then status:='different_running_plan';blocked:=blocked+1;
   elsif not public.learning_eligible(p,target_plan,now()) then status:='eligibility_needed';blocked:=blocked+1;
   else status:='new_enrollment';new_count:=new_count+1;end if;
  end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('name',label,'state',status));
 end loop;
 if jsonb_array_length(rows)=0 then raise exception 'Group has no available athletes.';end if;
 return jsonb_build_object('members',rows,'new_count',new_count,'kept_count',kept,'blocked_count',blocked);
end$$;
create or replace function public.learning_enroll_cohort(target_cohort uuid,target_plan uuid,operation_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare p uuid;n integer:=0;existing integer;preview jsonb;begin
 perform public.learning_require_owner();perform pg_advisory_xact_lock(hashtextextended(target_cohort::text,2121));perform pg_advisory_xact_lock(hashtextextended(operation_id::text,1922));
 select count(*) into existing from public.learning_audit where action='enroll_cohort' and target=operation_id;
 if existing>0 then
  if not exists(select 1 from public.learning_audit where action='enroll_cohort' and target=operation_id and detail->>'cohort'=target_cohort::text and detail->>'plan'=target_plan::text) then raise exception 'Group operation ID already used.';end if;
  return (select (detail->>'count')::integer from public.learning_audit where action='enroll_cohort' and target=operation_id limit 1);
 end if;
 -- Lock every member before rechecking eligibility so partial enrollment cannot
 -- result from a concurrent single-athlete action. Historical plans stay intact.
 for p in select profile_id from public.learning_cohort_members where cohort_id=target_cohort order by profile_id loop perform pg_advisory_xact_lock(hashtextextended(p::text,1921));end loop;
 preview:=public.learning_group_enrollment_preview(target_cohort,target_plan);
 if (preview->>'blocked_count')::integer>0 then raise exception 'Group enrollment needs eligibility or a conflicting running plan resolved. Nobody was enrolled.';end if;
 for p in select profile_id from public.learning_cohort_members where cohort_id=target_cohort order by profile_id loop
  if (select plan_id from public.learning_enrollments where profile_id=p and state in ('active','paused','finished') order by created_at desc,id desc limit 1)=target_plan then continue;end if;
  perform public.learning_enroll(gen_random_uuid(),p,target_plan,true);n:=n+1;
 end loop;
 insert into public.learning_audit(actor_id,action,target,detail) values(auth.uid(),'enroll_cohort',operation_id,jsonb_build_object('count',n,'cohort',target_cohort,'plan',target_plan));return n;
end$$;
revoke all on function public.learning_group_enrollment_preview(uuid,uuid) from public,anon;
grant execute on function public.learning_group_enrollment_preview(uuid,uuid) to authenticated;
-- Internal summary/search are called only from the guarded definer endpoints.
revoke all on function public.learning_search(text),public.learning_staff_summary(uuid) from authenticated;
create or replace function public.learning_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform public.learning_require_staff();return jsonb_build_object('plans',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('weeks_content',coalesce((select jsonb_agg(to_jsonb(w)||jsonb_build_object('ready',public.learning_week_ready(w.id)) order by week_number,revision desc) from public.learning_week_versions w where w.plan_id=p.id),'[]'))) from public.learning_plans p where p.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'quizzes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'quiz_id',v.quiz_id,'title',q.title,'revision',v.revision,'questions',v.questions,'keys',k.keys,'total_points',v.total_points)) from public.learning_quiz_versions v join public.learning_quizzes q on q.id=v.quiz_id join public.learning_quiz_keys k on k.version_id=v.id where v.created_by=auth.uid() or q.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'rules',(select jsonb_build_object('friday_time',friday_time::text,'low_ready_weeks',low_ready_weeks) from public.learning_settings),'cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',p.nickname) order by p.nickname) from public.learning_cohort_members m join public.player_profiles p on p.id=m.profile_id where m.cohort_id=c.id and public.learning_profile_allowed(m.profile_id)),'[]'),'profiles',coalesce((select jsonb_agg(m.profile_id) from public.learning_cohort_members m where m.cohort_id=c.id and public.learning_profile_allowed(m.profile_id)),'[]'))) from public.learning_cohorts c where public.current_account_role() in ('owner','manager') or exists(select 1 from public.learning_cohort_members m where m.cohort_id=c.id and public.staff_can_view_service_athlete(m.profile_id))),'[]'));
end$$;
create or replace function public.learning_inbox() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'profile_id',n.profile_id,'athlete_name',(select nickname from public.player_profiles where id=n.profile_id),'next_due_at',(select next_release_at from public.learning_enrollments where profile_id=n.profile_id and state='active' order by created_at desc,id desc limit 1),'release_id',n.release_id,'category',n.category,'created_at',n.created_at,'read',exists(select 1 from public.learning_notice_reads r where r.notice_id=n.id and r.user_id=auth.uid())) order by n.created_at desc),'[]')
 from public.learning_notices n where n.resolved_at is null and public.learning_profile_allowed(n.profile_id) and ((n.staff_only and public.staff_can_view_service_athlete(n.profile_id) and exists(select 1 from public.learning_enrollments e where e.profile_id=n.profile_id and e.state='active' and public.learning_eligible(e.profile_id,e.plan_id,now())))
 or (not n.staff_only and public.can_view_athlete(n.profile_id) and exists(select 1 from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=n.release_id and public.learning_eligible(e.profile_id,e.plan_id,now()) and (n.category<>'friday_incomplete' or (e.state in ('active','finished') and public.learning_can_submit(e.profile_id) and r.sequence=(select max(latest.sequence) from public.learning_releases latest where latest.enrollment_id=e.id))))))
$$;

do $verify$ begin
 if exists(select 1 from public.learning_settings where enabled or scheduler_enabled or notices_enabled or youth_enabled)
 or exists(select 1 from public.profile_settings where under18_enabled or child_self_access_enabled)
 or exists(select 1 from public.staff_notification_settings where email_enabled or inapp_observation_enabled)
 or exists(select 1 from public.interest_intake_settings where enabled)
 or exists(select 1 from public.delivery_monitor_settings where enabled) then raise exception 'STOP: an activation flag was unexpectedly enabled.';end if;
 if exists(select 1 from auth.users) or exists(select 1 from storage.objects) then raise exception 'STOP: unexpected user/file data.';end if;
 if has_function_privilege('authenticated','public.learning_tick(timestamptz,boolean)','EXECUTE')
 or has_table_privilege('anon','public.learning_quiz_keys','SELECT')
 or has_table_privilege('authenticated','public.learning_quiz_keys','SELECT') then raise exception 'STOP: unexpected public/scheduler access.';end if;
 if exists(select 1 from pg_tables where schemaname='public' and tablename like 'learning_%' and not rowsecurity) then raise exception 'STOP: a learning table lacks RLS.';end if;
end $verify$;

commit;
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
