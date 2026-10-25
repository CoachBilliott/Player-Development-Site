-- Apply once after 007. Private staff templates and one current workout per account.
-- Existing loose-drill permissions, reviews, billing and junior gates are unchanged.
begin;
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
commit;
