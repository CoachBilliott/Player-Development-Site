-- Apply once after 001 and 002 in the dedicated Player Development project.
begin;
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
commit;
