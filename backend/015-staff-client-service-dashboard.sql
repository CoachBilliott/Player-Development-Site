-- REVIEW DRAFT, NOT installed. Repformed's existing single-project boundary.
-- Basic service metadata only; does NOT widen can_view_athlete/video permissions.
begin;
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
commit;
