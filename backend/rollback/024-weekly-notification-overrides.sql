-- REVIEW DRAFT: restore former notification logic; keep preferences/history/columns.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$begin
 if exists(select 1 from public.learning_settings where enabled or scheduler_enabled or notices_enabled or youth_enabled) then
  raise exception 'Disable learning, scheduler, notices and youth before rollback; retain opt-outs and history. Do not re-enable the older global-only scheduler without compatibility review.';
 end if;
end$$;
create or replace function public.learning_tick(at_time timestamptz default now(),dry_run boolean default true) returns jsonb
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
create or replace function public.learning_inbox() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'profile_id',n.profile_id,'athlete_name',(select nickname from public.player_profiles where id=n.profile_id),'next_due_at',(select next_release_at from public.learning_enrollments where profile_id=n.profile_id and state='active' order by created_at desc,id desc limit 1),'release_id',n.release_id,'category',n.category,'created_at',n.created_at,'read',exists(select 1 from public.learning_notice_reads r where r.notice_id=n.id and r.user_id=auth.uid())) order by n.created_at desc),'[]')
 from public.learning_notices n where n.resolved_at is null and public.learning_profile_allowed(n.profile_id) and ((n.staff_only and public.staff_can_view_service_athlete(n.profile_id) and exists(select 1 from public.learning_enrollments e where e.profile_id=n.profile_id and e.state='active' and public.learning_eligible(e.profile_id,e.plan_id,now())))
 or (not n.staff_only and public.can_view_athlete(n.profile_id) and exists(select 1 from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=n.release_id and public.learning_eligible(e.profile_id,e.plan_id,now()) and (n.category<>'friday_incomplete' or (e.state in ('active','finished') and public.learning_can_submit(e.profile_id) and r.sequence=(select max(latest.sequence) from public.learning_releases latest where latest.enrollment_id=e.id))))))
$$;
drop function public.learning_notification_workspace(uuid);
drop function public.learning_save_notification_rule(text,uuid,uuid,jsonb,integer,uuid);
drop function public.learning_notification_rules(uuid);
drop function public.learning_validate_notification_rule(jsonb);
notify pgrst,'reload schema';
commit;
