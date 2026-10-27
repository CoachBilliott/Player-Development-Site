-- REVIEW DRAFT ONLY. No production application, scheduler, sender or push setup.
-- Manual checks record observation time, never a fabricated first-delivery time.
begin;
create table public.delivery_monitor_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into public.delivery_monitor_settings default values;
create table public.delivery_packages(
 id uuid primary key,title text not null check(length(btrim(title)) between 1 and 80),
 rule jsonb not null,version integer not null default 1,updated_at timestamptz not null default now()
);
create table public.delivery_client_settings(
 client_id uuid primary key references public.member_accounts(user_id) on delete cascade,
 package_id uuid not null references public.delivery_packages(id),overrides jsonb not null default '{}',
 state text not null default 'active' check(state in ('active','paused','cancelled')),
 version integer not null default 1
);
create table public.delivery_athlete_settings(
 profile_id uuid primary key references public.player_profiles(id) on delete cascade,
 overrides jsonb not null default '{}',state text not null default 'active' check(state in ('active','paused','cancelled')),
 version integer not null default 1
);
create table public.delivery_expectations(
 id uuid primary key,profile_id uuid not null references public.player_profiles(id) on delete cascade,
 cycle_key text not null check(length(btrim(cycle_key)) between 1 and 80),
 workout_id uuid references public.training_workouts(id) on delete set null,workout_version integer not null,
 resource_versions jsonb not null,rule_snapshot jsonb not null,
 due_at timestamptz not null,notice_not_before timestamptz not null,
 state text not null default 'active' check(state in ('active','paused','cancelled')),
 first_observed_available_at timestamptz,last_checked_at timestamptz,last_checked_by uuid references auth.users(id) on delete set null,
 unique(profile_id,cycle_key),check(notice_not_before<=due_at)
);
create table public.delivery_alerts(
 expectation_id uuid primary key references public.delivery_expectations(id) on delete cascade,
 state text not null check(state in ('open','acknowledged','resolved')),
 opened_at timestamptz not null default now(),acknowledged_at timestamptz,acknowledged_by uuid references auth.users(id) on delete set null,
 resolved_at timestamptz,resolution text,escalated_at timestamptz,
 episode integer not null default 1
);
create table public.content_notices(
 id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.player_profiles(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('training_ready','review_ready')),
 source_id uuid not null,source_version text not null,event_key text not null unique,
 observed_at timestamptz not null default now(),read_at timestamptz,
 email_status text not null default 'disabled' check(email_status='disabled')
);
-- No browser raw table reads/writes, including configuration and outbox.
alter table public.delivery_monitor_settings enable row level security;
alter table public.delivery_packages enable row level security;
alter table public.delivery_client_settings enable row level security;
alter table public.delivery_athlete_settings enable row level security;
alter table public.delivery_expectations enable row level security;
alter table public.delivery_alerts enable row level security;
alter table public.content_notices enable row level security;
revoke all on public.delivery_monitor_settings,public.delivery_packages,public.delivery_client_settings,public.delivery_athlete_settings,public.delivery_expectations,public.delivery_alerts,public.content_notices from public,anon,authenticated;

create function public.validate_delivery_rule(patch jsonb,full_rule boolean) returns void
language plpgsql stable security definer set search_path='' as $$
declare k text;
begin
 if patch is null or jsonb_typeof(patch) is distinct from 'object' then raise exception 'Choose valid delivery settings.';end if;
 for k in select jsonb_object_keys(patch) loop
  if k not in ('weekday','time','timezone','grace_minutes','escalation_minutes','routing','notify_training','notify_reviews','email_requested','submission_reminders','submission_cadence_hours','submission_expectation') or patch->k='null'::jsonb then raise exception 'Unknown or empty delivery setting.';end if;
 end loop;
 if full_rule and not patch ?& array['weekday','time','timezone','grace_minutes','escalation_minutes','routing','notify_training','notify_reviews','email_requested','submission_reminders'] then raise exception 'Complete the package delivery defaults.';end if;
 if patch ? 'weekday' and (jsonb_typeof(patch->'weekday')<>'number' or (patch->>'weekday') !~ '^[0-6]$') then raise exception 'Choose a due day.';end if;
 if patch ? 'time' and (patch->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Choose a valid local due time.';end if;
 if patch ? 'timezone' and not exists(select 1 from pg_timezone_names where name=patch->>'timezone') then raise exception 'Choose a valid IANA time zone.';end if;
 foreach k in array array['grace_minutes','escalation_minutes'] loop
  if patch ? k and ((patch->>k) !~ '^[0-9]{1,5}$' or (patch->>k)::integer>10080) then raise exception 'Choose a delay from 0 through 10080 minutes.';end if;
 end loop;
 if patch ? 'routing' and patch->>'routing' not in ('assigned_coach','owners_managers') then raise exception 'Choose staff-only alert routing.';end if;
 foreach k in array array['notify_training','notify_reviews','email_requested','submission_reminders'] loop
  if patch ? k and jsonb_typeof(patch->k)<>'boolean' then raise exception 'Choose valid notification preferences.';end if;
 end loop;
 if patch->>'submission_reminders'='true' then raise exception 'Submission reminder meaning and cadence require review; keep disabled.';end if;
 if patch ? 'submission_cadence_hours' and ((patch->>'submission_cadence_hours') !~ '^[0-9]{1,3}$' or (patch->>'submission_cadence_hours')::integer not between 1 and 168) then raise exception 'Choose a draft reminder cadence from 1 through 168 hours.';end if;
 if patch ? 'submission_expectation' and (jsonb_typeof(patch->'submission_expectation')<>'string' or length(btrim(patch->>'submission_expectation')) not between 1 and 200) then raise exception 'Describe the draft expected submission in 1 through 200 characters.';end if;
end;
$$;
create function public.delivery_rule_for(target_profile uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select d.rule||c.overrides||coalesce(a.overrides,'{}') from public.player_profiles p
 join public.delivery_client_settings c on c.client_id=p.owner_id join public.delivery_packages d on d.id=c.package_id
 left join public.delivery_athlete_settings a on a.profile_id=p.id where p.id=target_profile;
$$;
create function public.assert_delivery_owner() returns void language plpgsql stable security definer set search_path='' as $$
begin if public.current_account_role() is distinct from 'owner' or public.account_is_closing(auth.uid()) then raise exception 'Owner access is required for delivery configuration.';end if;end;
$$;
create function public.save_delivery_package(package_id uuid,title text,rule jsonb,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare old public.delivery_packages;
begin
 perform public.assert_delivery_owner();perform public.validate_delivery_rule(rule,true);
 perform pg_advisory_xact_lock(hashtextextended(package_id::text,1616));
 select * into old from public.delivery_packages where id=package_id for update;
 if coalesce(old.version,0)<>expected_version then
  if old.version=expected_version+1 and old.title=title and old.rule=rule then return;end if;
  raise exception 'Delivery defaults changed. Refresh before saving.';
 end if;
 insert into public.delivery_packages(id,title,rule) values(package_id,btrim(title),rule)
 on conflict(id) do update set title=excluded.title,rule=excluded.rule,version=delivery_packages.version+1,updated_at=now();
end;
$$;
create function public.save_delivery_override(target_profile uuid,scope text,package_id uuid,overrides jsonb,state text,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare customer uuid;v integer;old jsonb;old_package uuid;old_state text;
begin
 perform public.assert_delivery_owner();perform public.validate_delivery_rule(overrides,false);
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 select owner_id into customer from public.player_profiles where id=target_profile;
 -- Serialize the shared client row across different sibling editors.
 perform pg_advisory_xact_lock(hashtextextended(customer::text,1617));
 if state not in ('active','paused','cancelled') or state is null then raise exception 'Choose a service state.';end if;
 if scope='client' then
  select c.version,c.overrides,c.package_id,c.state into v,old,old_package,old_state from public.delivery_client_settings c where c.client_id=customer for update;
  if coalesce(v,0)<>expected_version then
   if v=expected_version+1 and old=overrides and old_package=package_id and old_state=state then return;end if;
   raise exception 'Client delivery settings changed. Refresh.';
  end if;
  insert into public.delivery_client_settings(client_id,package_id,overrides,state) values(customer,package_id,overrides,state)
  on conflict(client_id) do update set package_id=excluded.package_id,overrides=excluded.overrides,state=excluded.state,version=delivery_client_settings.version+1;
 elsif scope='athlete' then
  if state not in ('active','paused','cancelled') or state is null then raise exception 'Choose an athlete service state.';end if;
  select a.version,a.overrides,a.state into v,old,old_state from public.delivery_athlete_settings a where a.profile_id=target_profile for update;
  if coalesce(v,0)<>expected_version then
   if v=expected_version+1 and old=overrides and old_state=state then return;end if;
   raise exception 'Athlete delivery settings changed. Refresh.';
  end if;
  insert into public.delivery_athlete_settings(profile_id,overrides,state) values(target_profile,overrides,state)
  on conflict(profile_id) do update set overrides=excluded.overrides,state=excluded.state,version=delivery_athlete_settings.version+1;
 else raise exception 'Choose client or athlete settings.';end if;
end;
$$;
create function public.delivery_wall_instant(local_date date,local_time text,zone text) returns timestamptz
language plpgsql stable security definer set search_path='' as $$
declare wall timestamp;result timestamptz;n integer;
begin
 perform public.validate_delivery_rule(jsonb_build_object('time',local_time,'timezone',zone),false);
 if local_date is null then raise exception 'Choose a calendar date.';end if;
 wall:=local_date+local_time::time;
 -- Compare candidate offsets on both sides of a clock transition. Reject skipped
 -- and repeated local times; never silently pick one side of an ambiguous hour.
 select count(distinct candidate),min(candidate) into n,result from (
  select (wall at time zone 'UTC')-((t at time zone zone)-(t at time zone 'UTC')) candidate
  from generate_series((wall at time zone 'UTC')-interval '36 hours',(wall at time zone 'UTC')+interval '36 hours',interval '12 hours') t
 ) c where candidate at time zone zone=wall;
 if n<>1 then raise exception 'That local time is skipped or repeated by a clock change. Choose another time.';end if;
 return result;
end;
$$;
create function public.plan_delivery_check(check_id uuid,target_profile uuid,cycle_key text,workout uuid,workout_version integer,local_date date,notice_not_before timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare rule jsonb;due timestamptz;w public.training_workouts;snap jsonb;old public.delivery_expectations;
begin
 perform public.assert_delivery_owner();
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 rule:=public.delivery_rule_for(target_profile);
 if rule is null then raise exception 'Choose package defaults for this client first.';end if;
 if extract(dow from local_date)::integer<>(rule->>'weekday')::integer then raise exception 'The date must match the configured due day.';end if;
 due:=public.delivery_wall_instant(local_date,rule->>'time',rule->>'timezone');
 if notice_not_before is null or notice_not_before>due then raise exception 'Choose a notice boundary at or before the delivery deadline.';end if;
 select * into w from public.training_workouts where id=workout and version=workout_version;
 if not found then raise exception 'Choose the current saved workout version.';end if;
 select jsonb_object_agg(r.id::text,r.version) into snap from public.training_resources r where r.id=any(w.resource_ids);
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,1618));
 select * into old from public.delivery_expectations where id=check_id;
 if found then
  if old.profile_id=target_profile and old.cycle_key=cycle_key and old.workout_id=workout and old.workout_version=workout_version and old.due_at=due and old.notice_not_before=notice_not_before and old.rule_snapshot=rule and old.resource_versions=snap then return;end if;
  raise exception 'This delivery check ID already has different details.';
 end if;
 insert into public.delivery_expectations(id,profile_id,cycle_key,workout_id,workout_version,resource_versions,rule_snapshot,due_at,notice_not_before)
 values(check_id,target_profile,btrim(cycle_key),workout,workout_version,snap,rule,due,notice_not_before);
end;
$$;
create function public.delivery_recipient(target_profile uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select p.owner_id from public.player_profiles p join public.member_accounts a on a.user_id=p.owner_id join auth.users u on u.id=p.owner_id
 where p.id=target_profile and u.email_confirmed_at is not null and not public.account_is_closing(p.owner_id)
 and not exists(select 1 from public.guardian_managed_athletes g where g.user_id=p.owner_id)
 and ((p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id))
 or (a.account_type='parent' and p.guardian_confirmed and exists(select 1 from public.profile_settings where under18_enabled)
 and exists(select 1 from public.guardian_access_reviews g where g.profile_id=p.id)));
$$;
create function public.set_delivery_check_state(check_id uuid,state text,expected_state text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.delivery_expectations;
begin
 perform public.assert_delivery_owner();
 if state is null or state not in ('active','paused','cancelled') then raise exception 'Choose a delivery-check state.';end if;
 select * into e from public.delivery_expectations where id=check_id for update;
 if not found or not public.staff_can_view_service_athlete(e.profile_id) then raise exception 'This delivery check is unavailable.';end if;
 if e.state=state then return;end if;
 if e.state is distinct from expected_state then raise exception 'This delivery check changed. Refresh.';end if;
 update public.delivery_expectations set state=set_delivery_check_state.state where id=check_id;
end;
$$;
create function public.delivery_check_available(e public.delivery_expectations) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare a public.member_workout_assignments;
begin
 -- Monitoring pause/cancellation does not revoke actual training access.
 if public.delivery_recipient(e.profile_id) is null then return false;end if;
 a:=public.effective_workout_assignment(e.profile_id);
 return coalesce(a.workout_id=e.workout_id and a.workout_version=e.workout_version and cardinality(a.resource_ids)=(select count(*) from jsonb_object_keys(e.resource_versions))
 and public.workout_matches_athlete(e.profile_id,a.resource_ids)
 and not exists(select 1 from jsonb_each(e.resource_versions) expected left join public.training_resources r on r.id::text=expected.key
 where r.id is null or not(r.id=any(a.resource_ids)) or r.version<>(expected.value::text)::integer or r.review_stage<>'approved' or r.status<>'published'
 or not exists(select 1 from storage.objects o where o.bucket_id='training-media' and o.name=r.asset_path and coalesce((o.metadata->>'size')::bigint,0)>0 and o.metadata->>'mimetype'=r.asset_type)),false);
end;
$$;
create function public.evaluate_delivery_checks(target_profile uuid) returns void
language plpgsql security definer set search_path='' as $$
declare e public.delivery_expectations;s public.review_services;rule jsonb;recipient uuid;ready boolean;paused boolean;v public.athlete_video_reviews;
begin
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is outside your service roster.';end if;
 if not exists(select 1 from public.delivery_monitor_settings where enabled) then raise exception 'Manual delivery monitoring has not been activated.';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,1618));
 recipient:=public.delivery_recipient(target_profile);
 rule:=public.delivery_rule_for(target_profile);
 paused:=exists(select 1 from public.delivery_athlete_settings where profile_id=target_profile and state<>'active') or exists(select 1 from public.delivery_client_settings c join public.player_profiles p on p.owner_id=c.client_id where p.id=target_profile and c.state<>'active');
 for e in select * from public.delivery_expectations where profile_id=target_profile for update loop
  ready:=public.delivery_check_available(e);
  update public.delivery_expectations set last_checked_at=now(),last_checked_by=auth.uid(),first_observed_available_at=case when ready then coalesce(first_observed_available_at,now()) else first_observed_available_at end where id=e.id;
  if paused or e.state<>'active' or ready then
   update public.delivery_alerts set state='resolved',resolved_at=coalesce(resolved_at,now()),resolution=case when ready then 'Accessible when checked' else 'Service paused or cancelled' end where expectation_id=e.id and state<>'resolved';
  elsif now()>=e.due_at+make_interval(mins=>(e.rule_snapshot->>'grace_minutes')::integer) then
   insert into public.delivery_alerts(expectation_id,state) values(e.id,'open') on conflict(expectation_id) do update set
    state=case when delivery_alerts.state='resolved' then 'open' else delivery_alerts.state end,
    episode=delivery_alerts.episode+case when delivery_alerts.state='resolved' then 1 else 0 end,
    opened_at=case when delivery_alerts.state='resolved' then now() else delivery_alerts.opened_at end,
    acknowledged_at=case when delivery_alerts.state='resolved' then null else delivery_alerts.acknowledged_at end,
    acknowledged_by=case when delivery_alerts.state='resolved' then null else delivery_alerts.acknowledged_by end,
    escalated_at=case when delivery_alerts.state='resolved' then null else delivery_alerts.escalated_at end,resolved_at=null,resolution=null;
   update public.delivery_alerts set escalated_at=coalesce(escalated_at,now()) where expectation_id=e.id and state='open'
    and (e.rule_snapshot->>'escalation_minutes')::integer>0 and now()>=e.due_at+make_interval(mins=>(e.rule_snapshot->>'grace_minutes')::integer+(e.rule_snapshot->>'escalation_minutes')::integer);
  end if;
  if ready and not paused and e.state='active' and now()>=e.notice_not_before and coalesce((e.rule_snapshot->>'notify_training')::boolean,false) and coalesce((rule->>'notify_training')::boolean,false) then
   insert into public.content_notices(profile_id,recipient_id,kind,source_id,source_version,event_key)
   values(target_profile,recipient,'training_ready',e.id,e.workout_version::text,'training:'||e.id::text||':'||recipient::text) on conflict(event_key) do nothing;
  end if;
 end loop;
 -- Reviews are a separate content-ready event; no athlete submission reminder
 -- is inferred from an overdue staff delivery or a raw upload.
 if not paused and recipient is not null and coalesce((rule->>'notify_reviews')::boolean,false) then
  for s in select * from public.review_services where profile_id=target_profile and state='delivered' and delivered_at is not null loop
   if public.current_account_role()='coach' and s.assigned_to is distinct from auth.uid() then continue;end if;
   select * into v from public.athlete_video_reviews where id=s.video_id;
   if (s.is_grouped and s.group_submitted_at is not null and s.group_reviewed_by is not null and not s.group_erased and length(btrim(s.group_feedback))>0)
    or (not s.is_grouped and v.status='reviewed' and v.reviewed_by is not null and length(btrim(v.feedback))>0 and exists(select 1 from storage.objects o where o.bucket_id='athlete-review-videos' and o.name=v.asset_path)) then
    insert into public.content_notices(profile_id,recipient_id,kind,source_id,source_version,event_key)
    values(target_profile,recipient,'review_ready',s.id,s.delivered_at::text,'review:'||s.id::text||':'||s.delivered_at::text||':'||recipient::text) on conflict(event_key) do nothing;
   end if;
  end loop;
 end if;
end;
$$;
create function public.acknowledge_delivery_alert(check_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.delivery_expectations e where e.id=check_id and public.staff_can_view_service_athlete(e.profile_id)
 and (public.current_account_role() in ('owner','manager') or e.rule_snapshot->>'routing'='assigned_coach')) then raise exception 'This staff alert is outside your scope.';end if;
 update public.delivery_alerts set state='acknowledged',acknowledged_at=now(),acknowledged_by=auth.uid() where expectation_id=check_id and state='open';
end;
$$;
create function public.delivery_profile_workspace(target_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare customer uuid;result jsonb;
begin
 if not public.staff_can_view_service_athlete(target_profile) then raise exception 'This athlete is outside your service roster.';end if;
 select owner_id into customer from public.player_profiles where id=target_profile;
 return jsonb_build_object('manual_only',true,'email_adapter','disabled','enabled',coalesce((select enabled from public.delivery_monitor_settings),false),
 'packages',coalesce((select jsonb_agg(to_jsonb(p) order by title) from public.delivery_packages p where public.current_account_role()='owner' or p.id=(select package_id from public.delivery_client_settings where client_id=customer)),'[]'::jsonb),
 'client', (select to_jsonb(c) from public.delivery_client_settings c where client_id=customer),
 'athlete',(select to_jsonb(a) from public.delivery_athlete_settings a where profile_id=target_profile),'effective_rule',public.delivery_rule_for(target_profile),
 'checks',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('available_now',public.delivery_check_available(e),'alert',
 case when public.current_account_role() in ('owner','manager') or e.rule_snapshot->>'routing'='assigned_coach' then (select to_jsonb(a) from public.delivery_alerts a where expectation_id=e.id) else null end) order by e.due_at desc) from public.delivery_expectations e where e.profile_id=target_profile),'[]'::jsonb));
end;
$$;
create function public.my_content_notices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or public.account_is_closing(auth.uid()) then raise exception 'Verified member access is required.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'profile_id',n.profile_id,'athlete_name',(select nickname from public.player_profiles where id=n.profile_id),'kind',n.kind,'observed_at',n.observed_at,'read_at',n.read_at,'email_status',n.email_status,
 'available_now',case when n.kind='training_ready' then exists(select 1 from public.delivery_expectations e where e.id=n.source_id and public.delivery_check_available(e))
 else exists(select 1 from public.review_services s where s.id=n.source_id and s.state='delivered' and ((s.is_grouped and s.group_submitted_at is not null and s.group_reviewed_by is not null and not s.group_erased and length(btrim(s.group_feedback))>0) or exists(select 1 from public.athlete_video_reviews v where v.id=s.video_id and v.status='reviewed' and v.reviewed_by is not null and length(btrim(v.feedback))>0))) end) order by n.observed_at desc)
 from (select * from public.content_notices where recipient_id=auth.uid() order by observed_at desc limit 100) n where public.delivery_recipient(n.profile_id)=auth.uid()),'[]'::jsonb);
end;
$$;
create function public.delivery_staff_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() not in ('owner','manager','coach') or public.current_account_role() is null or public.account_is_closing(auth.uid()) then raise exception 'Staff access is required.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'profile_id',e.profile_id,'athlete_name',p.nickname,'cycle_key',e.cycle_key,'due_at',e.due_at,'timezone',e.rule_snapshot->>'timezone','last_checked_at',e.last_checked_at,'state',a.state,'escalated_at',a.escalated_at,'episode',a.episode,'available_now',public.delivery_check_available(e)) order by e.due_at)
 from public.delivery_alerts a join public.delivery_expectations e on e.id=a.expectation_id join public.player_profiles p on p.id=e.profile_id
 where a.state<>'resolved' and e.state='active' and public.staff_can_view_service_athlete(e.profile_id)
 and not exists(select 1 from public.delivery_athlete_settings s where s.profile_id=e.profile_id and s.state<>'active')
 and not exists(select 1 from public.delivery_client_settings c where c.client_id=p.owner_id and c.state<>'active')
 and (public.current_account_role() in ('owner','manager') or e.rule_snapshot->>'routing'='assigned_coach')),'[]'::jsonb);
end;
$$;
create function public.read_content_notice(notice_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.content_notices n set read_at=coalesce(read_at,now()) where n.id=notice_id and n.recipient_id=auth.uid() and public.delivery_recipient(n.profile_id)=auth.uid();
 if not found then raise exception 'This notification is unavailable.';end if;
end;
$$;
revoke all on function public.validate_delivery_rule(jsonb,boolean),public.delivery_rule_for(uuid),public.assert_delivery_owner(),public.delivery_wall_instant(date,text,text),public.delivery_recipient(uuid),public.delivery_check_available(public.delivery_expectations) from public,anon,authenticated;
revoke all on function public.save_delivery_package(uuid,text,jsonb,integer),public.save_delivery_override(uuid,text,uuid,jsonb,text,integer),public.plan_delivery_check(uuid,uuid,text,uuid,integer,date,timestamptz),public.set_delivery_check_state(uuid,text,text),public.evaluate_delivery_checks(uuid),public.acknowledge_delivery_alert(uuid),public.delivery_profile_workspace(uuid),public.my_content_notices(),public.read_content_notice(uuid) from public,anon;
grant execute on function public.save_delivery_package(uuid,text,jsonb,integer),public.save_delivery_override(uuid,text,uuid,jsonb,text,integer),public.plan_delivery_check(uuid,uuid,text,uuid,integer,date,timestamptz),public.set_delivery_check_state(uuid,text,text),public.evaluate_delivery_checks(uuid),public.acknowledge_delivery_alert(uuid),public.delivery_profile_workspace(uuid),public.my_content_notices(),public.read_content_notice(uuid) to authenticated;
notify pgrst,'reload schema';
revoke all on function public.delivery_staff_queue() from public,anon;
grant execute on function public.delivery_staff_queue() to authenticated;
commit;
