-- Add family-linked athletes, parent permissions and reviewed practice history.
-- Existing enrollment gates remain closed. Apply once after 003.
begin;
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
commit;
