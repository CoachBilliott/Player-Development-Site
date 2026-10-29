-- REVIEW DRAFT ONLY: not approved for hosted installation by the 023 approval.
-- Requires 016 and learning019-022, NOT023. No flags, Cron, emails or role grants.
-- Keep weekly preferences separate so older clients cannot erase unknown rule keys.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$begin
 if to_regclass('public.learning_settings') is null or to_regprocedure('public.learning_week_readiness(uuid)') is null
 or to_regprocedure('public.assert_delivery_owner()') is null then
  raise exception 'Reviewed delivery016 and learning019-022 prerequisites are required. Do not install unrelated drafts automatically.';
 end if;
 if exists(select 1 from public.learning_settings where enabled or scheduler_enabled or notices_enabled or youth_enabled) then
  raise exception 'Disable learning, scheduler, notices and youth before installing weekly notification overrides.';
 end if;
end$$;
alter table public.delivery_packages add column weekly_rules jsonb not null default '{}' check(jsonb_typeof(weekly_rules)='object');
alter table public.delivery_client_settings add column weekly_rules jsonb not null default '{}' check(jsonb_typeof(weekly_rules)='object');
alter table public.delivery_athlete_settings add column weekly_rules jsonb not null default '{}' check(jsonb_typeof(weekly_rules)='object'),
 add column weekly_package_id uuid references public.delivery_packages(id);

create function public.learning_validate_notification_rule(patch jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare k text;
begin
 if patch is null or jsonb_typeof(patch)<>'object' then raise exception 'Choose valid weekly notification overrides.';end if;
 for k in select jsonb_object_keys(patch) loop
  if k not in ('friday_time','reminders_enabled','low_ready_weeks') or patch->k='null'::jsonb then raise exception 'Unknown or empty weekly notification setting.';end if;
 end loop;
 if patch ? 'friday_time' and (jsonb_typeof(patch->'friday_time')<>'string' or patch->>'friday_time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Choose a valid Friday time in America/Chicago.';end if;
 if patch ? 'reminders_enabled' and jsonb_typeof(patch->'reminders_enabled')<>'boolean' then raise exception 'Choose whether Friday reminders are enabled.';end if;
 if patch ? 'low_ready_weeks' and (jsonb_typeof(patch->'low_ready_weeks')<>'number' or patch->>'low_ready_weeks' !~ '^[1-8]$') then raise exception 'Choose a ready-week threshold from 1 through 8.';end if;
end$$;
create function public.learning_notification_rules(target_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare context record;result jsonb;normal_rule jsonb;
begin
 select p.id,coalesce(a.weekly_package_id,c.package_id) package_id,
  coalesce(d.rule,'{}'::jsonb)||coalesce(c.overrides,'{}'::jsonb)||coalesce(a.overrides,'{}'::jsonb) normal_rule,
  coalesce(d.weekly_rules,'{}'::jsonb)||coalesce(c.weekly_rules,'{}'::jsonb)||coalesce(a.weekly_rules,'{}'::jsonb) weekly_rule
 into context from public.player_profiles p
 left join public.delivery_client_settings c on c.client_id=p.owner_id
 left join public.delivery_athlete_settings a on a.profile_id=p.id
 left join public.delivery_packages d on d.id=coalesce(a.weekly_package_id,c.package_id)
 where p.id=target_profile;
 if not found then raise exception 'This athlete is unavailable.';end if;
 perform public.learning_validate_notification_rule(context.weekly_rule);
 select jsonb_build_object('friday_time',friday_time::text,'reminders_enabled',true,'low_ready_weeks',low_ready_weeks) into result from public.learning_settings;
 normal_rule:=context.normal_rule;
 return result||context.weekly_rule||jsonb_build_object('timezone','America/Chicago',
  'training_notices',coalesce((normal_rule->>'notify_training')::boolean,true),
  'staff_routing',coalesce(normal_rule->>'routing','assigned_coach'));
end$$;
create function public.learning_notification_workspace(target_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare customer uuid;
begin
 perform public.assert_delivery_owner();
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is outside your service roster.';end if;
 select owner_id into customer from public.player_profiles where id=target_profile;
 return jsonb_build_object('profile_id',target_profile,
 'global',(select jsonb_build_object('friday_time',friday_time::text,'reminders_enabled',true,'low_ready_weeks',low_ready_weeks) from public.learning_settings),
 'runtime',(select jsonb_build_object('learning_enabled',enabled,'scheduler_enabled',scheduler_enabled,'notices_enabled',notices_enabled) from public.learning_settings),
 'packages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'rules',weekly_rules,'version',version) order by title,id) from public.delivery_packages),'[]'::jsonb),
 'client',(select jsonb_build_object('package_id',package_id,'rules',weekly_rules,'version',version) from public.delivery_client_settings where client_id=customer),
 'athlete',(select jsonb_build_object('package_id',weekly_package_id,'rules',weekly_rules,'version',version) from public.delivery_athlete_settings where profile_id=target_profile),
 'effective',public.learning_notification_rules(target_profile));
end$$;
create function public.learning_save_notification_rule(target_scope text,target_profile uuid,target_package uuid,rule_patch jsonb,expected_version integer,selected_weekly_package uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare customer uuid;v integer;old_rule jsonb;old_package uuid;
begin
 perform public.assert_delivery_owner();perform public.learning_validate_notification_rule(rule_patch);
 if expected_version is null or expected_version<0 then raise exception 'Refresh weekly settings before saving.';end if;
 if target_scope='package' then
  if target_package is null or target_profile is not null or selected_weekly_package is not null then raise exception 'Choose the package settings to change.';end if;
  perform pg_advisory_xact_lock(hashtextextended(target_package::text,1616));
  select version,weekly_rules into v,old_rule from public.delivery_packages where id=target_package for update;
  if v is null then raise exception 'Create the delivery package first.';end if;
  if v<>expected_version then
   if v=expected_version+1 and old_rule=rule_patch then return;end if;
   raise exception 'Package settings changed. Refresh before saving.';
  end if;
  update public.delivery_packages set weekly_rules=rule_patch,version=version+1,updated_at=now() where id=target_package;
 elsif target_scope in ('client','athlete') then
  if target_profile is null or target_package is not null or not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is outside your service roster.';end if;
  select owner_id into customer from public.player_profiles where id=target_profile;
  perform pg_advisory_xact_lock(hashtextextended(customer::text,1617));
  if target_scope='client' then
   if selected_weekly_package is not null then raise exception 'An athlete package override belongs to athlete settings.';end if;
   select version,weekly_rules into v,old_rule from public.delivery_client_settings where client_id=customer for update;
   if v is null then raise exception 'Choose household delivery package defaults first.';end if;
   if v<>expected_version then
    if v=expected_version+1 and old_rule=rule_patch then return;end if;
    raise exception 'Household settings changed. Refresh before saving.';
   end if;
   update public.delivery_client_settings set weekly_rules=rule_patch,version=version+1 where client_id=customer;
  else
   if selected_weekly_package is not null and not exists(select 1 from public.delivery_packages where id=selected_weekly_package) then raise exception 'Choose a known delivery package.';end if;
   select version,weekly_rules,weekly_package_id into v,old_rule,old_package from public.delivery_athlete_settings where profile_id=target_profile for update;
   if coalesce(v,0)<>expected_version then
    if v=expected_version+1 and old_rule=rule_patch and old_package is not distinct from selected_weekly_package then return;end if;
    raise exception 'Athlete settings changed. Refresh before saving.';
   end if;
   insert into public.delivery_athlete_settings(profile_id,weekly_rules,weekly_package_id) values(target_profile,rule_patch,selected_weekly_package)
   on conflict(profile_id) do update set weekly_rules=excluded.weekly_rules,weekly_package_id=excluded.weekly_package_id,version=delivery_athlete_settings.version+1;
  end if;
 else raise exception 'Choose package, household or athlete settings.';end if;
 insert into public.learning_audit(actor_id,action,target,detail) values(auth.uid(),'configure_weekly_notifications',coalesce(target_profile,target_package),jsonb_build_object('scope',target_scope,'previous_version',expected_version));
end$$;
revoke all on function public.learning_validate_notification_rule(jsonb),public.learning_notification_rules(uuid),public.learning_notification_workspace(uuid),public.learning_save_notification_rule(text,uuid,uuid,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.learning_notification_workspace(uuid),public.learning_save_notification_rule(text,uuid,uuid,jsonb,integer,uuid) to authenticated;

create or replace function public.learning_tick(at_time timestamptz default now(),dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare notification_rule jsonb;e public.learning_enrollments;w uuid;seq integer;count_release integer:=0;count_reminder integer:=0;count_low integer:=0;ready integer;next_no integer;last_r public.learning_releases;local_now timestamp;due timestamp;settings public.learning_settings;cat text;failed integer:=0;prior_release integer;prior_reminder integer;prior_low integer;
begin
 select * into settings from public.learning_settings;
 if not settings.enabled or (not dry_run and not settings.scheduler_enabled) then return jsonb_build_object('disabled',true);end if;
 local_now:=at_time at time zone 'America/Chicago';
 for e in select * from public.learning_enrollments where state in ('active','finished') order by id for update skip locked loop
  prior_release:=count_release;prior_reminder:=count_reminder;prior_low:=count_low;begin
  if not public.learning_eligible(e.profile_id,e.plan_id,at_time) or (not settings.youth_enabled and exists(select 1 from public.player_profiles p where p.id=e.profile_id and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)))) then continue;end if;
  notification_rule:=public.learning_notification_rules(e.profile_id);
  if e.state='active' and e.next_release_at<=at_time then
   w:=public.learning_selected_week(e.id,e.next_week);
   if public.learning_week_ready(w) and public.learning_week_matches_profile(w,e.profile_id) then
    count_release:=count_release+1;
    if not dry_run then
     select coalesce(max(sequence),0)+1 into seq from public.learning_releases where enrollment_id=e.id;
     insert into public.learning_releases(enrollment_id,sequence,week_number,week_version_id,scheduled_at,available_at) values(e.id,seq,e.next_week,w,e.next_release_at,at_time) returning * into last_r;
     update public.learning_enrollments set next_week=next_week+1,next_release_at=public.learning_next_sunday(at_time),version=version+1,state=case when next_week>=(select weeks from public.learning_plans where id=e.plan_id) then 'finished' else state end where id=e.id;
     if settings.notices_enabled and (notification_rule->>'training_notices')::boolean then insert into public.learning_notices(event_key,profile_id,release_id,category,staff_only) values('ready:'||last_r.id,e.profile_id,last_r.id,'content_ready',false) on conflict do nothing;end if;
    end if;
   end if;
  end if;
  select * into last_r from public.learning_releases where enrollment_id=e.id order by sequence desc limit 1;
  due:=(date_trunc('week',local_now+interval '1 day')-interval '1 day'+interval '5 days')::date+(notification_rule->>'friday_time')::time;
  if (notification_rule->>'reminders_enabled')::boolean and extract(dow from local_now)=5 and local_now>=due and last_r.id is not null and last_r.available_at at time zone 'America/Chicago'<due and not public.learning_release_done(last_r.id) then
   if not exists(select 1 from public.learning_notices where event_key='friday:'||last_r.id||':'||local_now::date) then
    count_reminder:=count_reminder+1;
    if not dry_run and settings.notices_enabled then insert into public.learning_notices(event_key,profile_id,release_id,category,staff_only) values('friday:'||last_r.id||':'||local_now::date,e.profile_id,last_r.id,'friday_incomplete',false) on conflict do nothing;end if;
   end if;
  end if;
  select next_week into next_no from public.learning_enrollments where id=e.id;
  ready:=0;
  while next_no+ready<=(select weeks from public.learning_plans where id=e.plan_id) and public.learning_week_ready(public.learning_selected_week(e.id,next_no+ready)) and public.learning_week_matches_profile(public.learning_selected_week(e.id,next_no+ready),e.profile_id) loop ready:=ready+1;end loop;
  cat:=case when ready=0 then 'no_content' else 'low_content' end;
  if next_no<=(select weeks from public.learning_plans where id=e.plan_id) and ready<(notification_rule->>'low_ready_weeks')::integer then
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
  update public.learning_notices n set resolved_at=at_time where n.category='friday_incomplete' and n.resolved_at is null and (not (public.learning_notification_rules(n.profile_id)->>'reminders_enabled')::boolean or public.learning_release_done(n.release_id) or not exists(select 1 from public.learning_releases r join public.learning_enrollments current_enrollment on current_enrollment.id=r.enrollment_id where r.id=n.release_id and current_enrollment.state in ('active','finished') and public.learning_eligible(current_enrollment.profile_id,current_enrollment.plan_id,at_time) and r.sequence=(select max(latest.sequence) from public.learning_releases latest where latest.enrollment_id=current_enrollment.id)));
 end if;
 return jsonb_build_object('dry_run',dry_run,'releases',count_release,'reminders',count_reminder,'low_content',count_low,'failed_enrollments',failed,'timezone','America/Chicago');
end$$;
create or replace function public.learning_inbox() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'profile_id',n.profile_id,'athlete_name',(select nickname from public.player_profiles where id=n.profile_id),'next_due_at',(select next_release_at from public.learning_enrollments where profile_id=n.profile_id and state='active' order by created_at desc,id desc limit 1),'release_id',n.release_id,'category',n.category,'created_at',n.created_at,'read',exists(select 1 from public.learning_notice_reads r where r.notice_id=n.id and r.user_id=auth.uid())) order by n.created_at desc),'[]')
 from public.learning_notices n where n.resolved_at is null and public.learning_profile_allowed(n.profile_id) and ((n.staff_only and public.staff_can_view_service_athlete(n.profile_id) and (public.current_account_role() in ('owner','manager') or public.learning_notification_rules(n.profile_id)->>'staff_routing'='assigned_coach') and exists(select 1 from public.learning_enrollments e where e.profile_id=n.profile_id and e.state='active' and public.learning_eligible(e.profile_id,e.plan_id,now())))
 or (not n.staff_only and public.can_view_athlete(n.profile_id) and (n.category<>'content_ready' or (public.learning_notification_rules(n.profile_id)->>'training_notices')::boolean) and exists(select 1 from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=n.release_id and public.learning_eligible(e.profile_id,e.plan_id,now()) and (n.category<>'friday_incomplete' or ((public.learning_notification_rules(n.profile_id)->>'reminders_enabled')::boolean and e.state in ('active','finished') and public.learning_can_submit(e.profile_id) and r.sequence=(select max(latest.sequence) from public.learning_releases latest where latest.enrollment_id=e.id))))))
$$;
notify pgrst,'reload schema';
commit;
