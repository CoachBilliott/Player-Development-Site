-- REVIEW DRAFT: apply once after 011 only after explicit migration/release approval.
-- No production migration, enrollment, consent, billing or scheduler activation.
begin;

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
commit;
