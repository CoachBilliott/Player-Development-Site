-- Apply ONLY this forward migration to an existing, preflight-verified database.
-- 019–024 are reserved for staged learning/roster work; do not renumber those files.
-- Requires the existing 001–018 account/lifecycle contracts; independent of 019–024.
-- Does not modify existing role/directory RPCs.
-- Generated with `supabase migration new adult_account_names`, stored in this
-- repository's numbered backend sequence. No records are populated here.
begin;
create table public.account_names (
  user_id uuid primary key references public.member_accounts(user_id) on delete cascade,
  display_name text,
  version integer not null default 1 check(version > 0),
  updated_at timestamptz not null default now(),
  constraint account_name_valid check(display_name is null or
    (display_name=btrim(display_name) and char_length(display_name) between 1 and 100
     and display_name !~ '[[:cntrl:]]'
     and display_name !~ U&'[\0080-\009F\00AD\0600-\0605\061C\06DD\070F\0890-\0891\08E2\180E\200B-\200F\2028-\202E\2060-\2064\2066-\206F\FEFF\FFF9-\FFFB\+0110BD\+0110CD\+013430-\+01343F\+01BCA0-\+01BCA3\+01D173-\+01D17A\+0E0001\+0E0020-\+0E007F]'))
);
alter table public.account_names enable row level security;
revoke all on public.account_names from public,anon,authenticated;
grant select on public.account_names to authenticated;
create policy "Read own adult account name" on public.account_names
  for select to authenticated using (user_id=(select auth.uid()));

-- Internal eligibility helper is not an exposed callable operation.
create function public.can_save_account_name() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and exists(select 1 from auth.users u join public.member_accounts a on a.user_id=u.id
      where u.id=auth.uid() and u.email_confirmed_at is not null and a.adult_confirmed_at is not null and a.privacy_acknowledged_at is not null)
    and not exists(select 1 from public.guardian_managed_athletes where user_id=auth.uid())
    and not public.account_is_closing(auth.uid());
$$;
revoke all on function public.can_save_account_name() from public,anon,authenticated;

create function public.get_my_account_name() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in is required.'; end if;
  return jsonb_build_object('eligible',public.can_save_account_name(),
    'display_name',(select display_name from public.account_names where user_id=auth.uid()),
    'version',coalesce((select version from public.account_names where user_id=auth.uid()),0));
end;
$$;
revoke all on function public.get_my_account_name() from public,anon;
grant execute on function public.get_my_account_name() to authenticated;

create function public.save_my_account_name(new_display_name text,expected_version integer,expected_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_version integer;
begin
  if auth.uid() is null then raise exception 'Sign in is required.'; end if;
  if expected_user_id is distinct from auth.uid() then raise exception 'The signed-in account changed. Reload before saving.'; end if;
  -- Match lifecycle ordering: closure advisory lock before the member/name rows.
  -- A save that waits for closure must re-check eligibility after that commit.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1011));
  -- Serialize first saves too; only auth.uid() determines the write target.
  perform 1 from public.member_accounts where user_id=auth.uid() for update;
  if not public.can_save_account_name() then raise exception 'Verified adult setup is required and this account must not be closing or parent-managed.'; end if;
  select version into current_version from public.account_names where user_id=auth.uid() for update;
  if expected_version is null or expected_version<>coalesce(current_version,0) then
    raise exception 'Your name changed in another session. Reload before saving.' using errcode='40001';
  end if;
  insert into public.account_names(user_id,display_name) values(auth.uid(),nullif(btrim(new_display_name),''))
    on conflict(user_id) do update set display_name=excluded.display_name,
      version=public.account_names.version+1,updated_at=clock_timestamp();
  return public.get_my_account_name();
end;
$$;
revoke all on function public.save_my_account_name(text,integer,uuid) from public,anon;
grant execute on function public.save_my_account_name(text,integer,uuid) to authenticated;

-- Delegate scope/filter/order/limit and Owner authorization to the existing RPC.
-- Join AFTER its limit: optional names cannot change which accounts are returned.
create function public.list_account_access_v2(search_text text default '')
returns table(user_id uuid,email text,role text,version integer,email_verified boolean,adult_setup boolean,display_name text)
language sql security definer set search_path='' as $$
  select a.*,n.display_name from public.list_account_access(search_text) a
    left join public.account_names n on n.user_id=a.user_id order by a.email;
$$;
revoke all on function public.list_account_access_v2(text) from public,anon;
grant execute on function public.list_account_access_v2(text) to authenticated;
commit;
