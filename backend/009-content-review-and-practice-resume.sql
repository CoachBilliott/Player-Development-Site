-- Apply once after 008. Private content approval and account-scoped unfinished practice.
-- Existing published resources are withdrawn for explicit staff review, never auto-approved.
begin;
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
commit;
