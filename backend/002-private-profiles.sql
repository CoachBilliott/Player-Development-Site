-- Apply AFTER 001-shared-content.sql in the dedicated Player Development project.
-- No live project has been configured by this migration file alone.
begin;

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
commit;
