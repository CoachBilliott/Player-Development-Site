-- REVIEW DRAFT ONLY. Requires 012/015/016; does not require grouped-media 013/014.
-- No migration, recipient selection, email send, signup trigger or cron activation
-- is authorized by adding this source. Client content updates remain IN-APP ONLY.
begin;
create table public.staff_notification_settings(
 singleton boolean primary key default true check(singleton),
 email_enabled boolean not null default false,
 inapp_observation_enabled boolean not null default false,
 email_since timestamptz,inapp_since timestamptz,
 signup_source text check(signup_source is null)
);
insert into public.staff_notification_settings default values;
create function public.guard_staff_notification_activation() returns trigger language plpgsql set search_path='' as $$
begin
 if new.email_enabled and not old.email_enabled then new.email_since:=clock_timestamp();else new.email_since:=old.email_since;end if;
 if new.inapp_observation_enabled and not old.inapp_observation_enabled then new.inapp_since:=clock_timestamp();else new.inapp_since:=old.inapp_since;end if;
 return new;
end;$$;
create trigger staff_notification_activation before update on public.staff_notification_settings for each row execute function public.guard_staff_notification_activation();
-- Selected staff IDs only: never arbitrary recipient addresses or client accounts.
-- Owner/operator recipient selection needs separate approval; initially no rows.
create table public.staff_notification_recipients(
 user_id uuid primary key references auth.users(id) on delete cascade,
 selected boolean not null default false,opted_out boolean not null default false,
 training_overdue boolean not null default true,review_overdue boolean not null default true
);
create table public.staff_notification_jobs(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('training_overdue','review_overdue')),
 profile_id uuid not null references public.player_profiles(id) on delete cascade,
 source_id uuid not null,recipient_id uuid not null references auth.users(id) on delete cascade,
 recipient_email text not null,due_at timestamptz not null,
 state text not null default 'queued' check(state in ('queued','processing','retry','accepted','failed','suppressed','uncertain')),
 attempts integer not null default 0 check(attempts between 0 and 4),
 created_at timestamptz not null default clock_timestamp(),first_attempt_at timestamptz,
 next_attempt_at timestamptz not null default clock_timestamp(),lease_token uuid,lease_until timestamptz,
 provider_id text,last_code text,updated_at timestamptz not null default clock_timestamp(),
 unique(kind,source_id,recipient_id)
);
create index staff_notification_jobs_due on public.staff_notification_jobs(state,next_attempt_at);
alter table public.staff_notification_settings enable row level security;
alter table public.staff_notification_recipients enable row level security;
alter table public.staff_notification_jobs enable row level security;
revoke all on public.staff_notification_settings,public.staff_notification_recipients,public.staff_notification_jobs from public,anon,authenticated;

create function public.operational_staff_eligible(staff uuid,target_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.account_roles r join auth.users u on u.id=r.user_id join public.player_profiles p on p.id=target_profile
 where r.user_id=staff and u.email_confirmed_at is not null and u.email is not null and not public.account_is_closing(staff)
 and not public.account_is_closing(p.owner_id) and public.delivery_recipient(p.id)=p.owner_id
 and (r.role in ('owner','manager') or (r.role='coach' and exists(select 1 from public.athlete_service_coaches c where c.profile_id=p.id and c.coach_id=staff))));
$$;
create function public.operational_source(kind text,source_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.delivery_expectations;s public.review_services;target uuid;deadline timestamptz;coach uuid;routing text;
begin
 if kind='training_overdue' then
  select * into e from public.delivery_expectations where id=source_id and state='active';
  if not found or public.delivery_check_available(e) then return null;end if;
  target:=e.profile_id;deadline:=e.due_at+make_interval(mins=>(e.rule_snapshot->>'grace_minutes')::integer);
  routing:=e.rule_snapshot->>'routing';select coach_id into coach from public.athlete_service_coaches where profile_id=target;
 elsif kind='review_overdue' then
  select * into s from public.review_services where id=source_id and state in ('queued','in_review') and ready_at is not null and due_at is not null;
  if not found or not exists(select 1 from public.member_training_access where account_id=s.account_id and video_review_enabled) then return null;end if;
  target:=s.profile_id;deadline:=s.due_at;coach:=s.assigned_to;routing:='assigned_coach';
 else return null;end if;
 if public.delivery_recipient(target) is null or exists(select 1 from public.delivery_athlete_settings where profile_id=target and state<>'active')
 or exists(select 1 from public.delivery_client_settings c join public.player_profiles p on p.owner_id=c.client_id where p.id=target and c.state<>'active') then return null;end if;
 return jsonb_build_object('profile_id',target,'due_at',deadline,'coach_id',coach,'routing',routing);
end;$$;
create function public.operational_recipient_allowed(staff uuid,kind text,source_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare source jsonb;coach uuid;role text;target uuid;
begin
 source:=public.operational_source(kind,source_id);if source is null then return false;end if;
 target:=(source->>'profile_id')::uuid;coach:=(source->>'coach_id')::uuid;
 if not public.operational_staff_eligible(staff,target) or not exists(select 1 from public.staff_notification_recipients r where r.user_id=staff and selected and not opted_out
 and case when kind='training_overdue' then training_overdue else review_overdue end) then return false;end if;
 select r.role into role from public.account_roles r where r.user_id=staff;
 if source->>'routing'='owners_managers' then return role in ('owner','manager');end if;
 if public.operational_staff_eligible(coach,target) and exists(select 1 from public.staff_notification_recipients r where r.user_id=coach and selected and not opted_out
 and case when kind='training_overdue' then training_overdue else review_overdue end) then return staff=coach;end if;
 return role in ('owner','manager');
end;$$;

-- Client-facing content readiness is IN-APP ONLY. No client email outbox exists.
create function public.notification_review_ready(service public.review_services) returns boolean
language sql stable security definer set search_path='' as $$
 select service.state='delivered' and service.delivered_at is not null
 and not coalesce((to_jsonb(service)->>'is_grouped')::boolean,false)
 and exists(select 1 from public.member_training_access a where a.account_id=service.account_id and a.video_review_enabled)
 and exists(select 1 from public.athlete_video_reviews v where v.id=service.video_id and v.profile_id=service.profile_id and v.account_id=service.account_id
 and v.status='reviewed' and v.reviewed_by is not null and length(btrim(v.feedback))>0
 and exists(select 1 from storage.objects o where o.bucket_id='athlete-review-videos' and o.name=v.asset_path));
$$;
create function public.observe_new_content_notices(batch_limit integer default 10) returns integer
language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz;item record;recipient uuid;rule jsonb;e public.delivery_expectations;s public.review_services;n integer;added integer:=0;
begin
 if batch_limit is null or batch_limit not between 1 and 10 then raise exception 'Choose a batch from 1 through 10.';end if;
 select inapp_since into cutoff from public.staff_notification_settings where inapp_observation_enabled;
 if cutoff is null then return 0;end if;
 for item in select 'training_ready'::text kind,id,profile_id from public.delivery_expectations where state='active' and notice_not_before>=cutoff and notice_not_before<=clock_timestamp()
 union all select 'review_ready',id,profile_id from public.review_services where state='delivered' and delivered_at>=cutoff loop
  recipient:=public.delivery_recipient(item.profile_id);rule:=public.delivery_rule_for(item.profile_id);
  if recipient is null or rule is null or exists(select 1 from public.delivery_athlete_settings where profile_id=item.profile_id and state<>'active')
  or exists(select 1 from public.delivery_client_settings where client_id=recipient and state<>'active') then continue;end if;
  if item.kind='training_ready' then
   select * into e from public.delivery_expectations where id=item.id;
   if not coalesce((rule->>'notify_training')::boolean,false) or not coalesce((e.rule_snapshot->>'notify_training')::boolean,false) or not public.delivery_check_available(e) then continue;end if;
   insert into public.content_notices(profile_id,recipient_id,kind,source_id,source_version,event_key)
   values(item.profile_id,recipient,item.kind,e.id,e.workout_version::text,'training:'||e.id::text||':'||recipient::text) on conflict(event_key) do nothing;
  else
   select * into s from public.review_services where id=item.id;
   if not coalesce((rule->>'notify_reviews')::boolean,false) or not public.notification_review_ready(s) then continue;end if;
   insert into public.content_notices(profile_id,recipient_id,kind,source_id,source_version,event_key)
   values(item.profile_id,recipient,item.kind,s.id,s.delivered_at::text,'review:'||s.id::text||':'||s.delivered_at::text||':'||recipient::text) on conflict(event_key) do nothing;
  end if;
  get diagnostics n=row_count;added:=added+n;if added>=batch_limit then return added;end if;
 end loop;
 return added;
end;$$;

-- Service-only preparation: one initial email per missed item/recipient, no recurring
-- reminder or historical backfill. A changed deadline suppresses an old job.
create function public.prepare_staff_notification_jobs(batch_limit integer default 10) returns integer
language plpgsql security definer set search_path='' as $$
declare item record;source jsonb;staff record;added integer:=0;n integer;cutoff timestamptz;
begin
 if batch_limit is null or batch_limit not between 1 and 10 then raise exception 'Choose a batch from 1 through 10.';end if;
 select email_since into cutoff from public.staff_notification_settings where email_enabled;
 if cutoff is null then return 0;end if;
 for item in select 'training_overdue'::text kind,id from public.delivery_expectations where state='active'
 union all select 'review_overdue',id from public.review_services where state in ('queued','in_review') loop
  source:=public.operational_source(item.kind,item.id);
  if source is null or (source->>'due_at')::timestamptz<cutoff or (source->>'due_at')::timestamptz>clock_timestamp() then continue;end if;
  for staff in select r.user_id,u.email from public.staff_notification_recipients r join auth.users u on u.id=r.user_id where public.operational_recipient_allowed(r.user_id,item.kind,item.id) loop
   insert into public.staff_notification_jobs(kind,profile_id,source_id,recipient_id,recipient_email,due_at)
   values(item.kind,(source->>'profile_id')::uuid,item.id,staff.user_id,staff.email,(source->>'due_at')::timestamptz)
   on conflict(kind,source_id,recipient_id) do nothing;
   get diagnostics n=row_count;added:=added+n;if added>=batch_limit then return added;end if;
  end loop;
 end loop;
 return added;
end;$$;
create function public.staff_notification_job_allowed(job public.staff_notification_jobs) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_notification_settings where email_enabled and email_since<=job.created_at)
 and public.operational_recipient_allowed(job.recipient_id,job.kind,job.source_id)
 and (public.operational_source(job.kind,job.source_id)->>'profile_id')::uuid=job.profile_id
 and (public.operational_source(job.kind,job.source_id)->>'due_at')::timestamptz=job.due_at
 and job.due_at<=clock_timestamp()
 and exists(select 1 from auth.users where id=job.recipient_id and email=job.recipient_email and email_confirmed_at is not null);
$$;
create function public.claim_staff_notification_jobs(batch_limit integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.staff_notification_jobs;items jsonb:='[]';
begin
 if batch_limit is null or batch_limit not between 1 and 10 then raise exception 'Choose a batch from 1 through 10.';end if;
 if not exists(select 1 from public.staff_notification_settings where email_enabled) then return items;end if;
 for j in select * from public.staff_notification_jobs where (state in ('queued','retry') and next_attempt_at<=clock_timestamp()) or (state='processing' and lease_until<clock_timestamp()) order by created_at for update skip locked limit batch_limit loop
  if not coalesce(public.staff_notification_job_allowed(j),false) then
   update public.staff_notification_jobs set state='suppressed',last_code='eligibility_changed',updated_at=clock_timestamp() where id=j.id;continue;
  end if;
  if j.first_attempt_at<=clock_timestamp()-interval '23 hours' then
   update public.staff_notification_jobs set state='uncertain',last_code='retry_window_expired',updated_at=clock_timestamp() where id=j.id;continue;
  end if;
  if j.attempts>=4 then
   update public.staff_notification_jobs set state='failed',last_code='attempt_limit',updated_at=clock_timestamp() where id=j.id;continue;
  end if;
  update public.staff_notification_jobs set state='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() where id=j.id returning * into j;
  items:=items||jsonb_build_array(jsonb_build_object('id',j.id,'kind',j.kind,'recipient_email',j.recipient_email,'lease_token',j.lease_token,'idempotency_key','repformed-staff/'||j.id::text||'/v1'));
 end loop;
 return items;
end;$$;
create function public.authorize_staff_notification_job(job_id uuid,lease uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select state='processing' and lease_token=lease and lease_until>clock_timestamp() and first_attempt_at>clock_timestamp()-interval '23 hours' and public.staff_notification_job_allowed(j)
 from public.staff_notification_jobs j where id=job_id),false);
$$;
create function public.finish_staff_notification_job(job_id uuid,lease uuid,outcome text,result_code text,provider_reference text default null,retry_after_seconds integer default 60) returns void
language plpgsql security definer set search_path='' as $$
begin
 if outcome is null or outcome not in ('accepted','retry','failed','suppressed','uncertain') or result_code is null or result_code !~ '^[a-z_]{1,50}$'
 or retry_after_seconds is null or retry_after_seconds not between 1 and 3600
 or (outcome='accepted' and (provider_reference is null or provider_reference !~ '^[a-zA-Z0-9_-]{1,100}$')) then raise exception 'Invalid dispatch outcome.';end if;
 update public.staff_notification_jobs set state=case when outcome='retry' and attempts>=4 then 'failed' else outcome end,
 last_code=result_code,provider_id=case when outcome='accepted' then provider_reference else provider_id end,
 next_attempt_at=clock_timestamp()+make_interval(secs=>retry_after_seconds),lease_until=null,updated_at=clock_timestamp()
 where id=job_id and state='processing' and lease_token=lease;
 if not found then raise exception 'Dispatch lease changed; outcome not recorded.';end if;
end;$$;

create function public.staff_notification_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is null or public.current_account_role() not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) then raise exception 'Staff access is required.';end if;
 return jsonb_build_object('email_enabled',(select email_enabled from public.staff_notification_settings),
 'inapp_observation_enabled',(select inapp_observation_enabled from public.staff_notification_settings),'signup_status','unconfigured',
 'selected',coalesce((select selected from public.staff_notification_recipients where user_id=auth.uid()),false),
 'opted_out',coalesce((select opted_out from public.staff_notification_recipients where user_id=auth.uid()),false),
 'jobs',coalesce((select jsonb_agg(item order by created_at desc) from (select j.created_at,jsonb_build_object('id',j.id,'kind',j.kind,'profile_id',j.profile_id,'athlete_name',p.nickname,'state',j.state,'attempts',j.attempts,'due_at',j.due_at,'updated_at',j.updated_at,'code',j.last_code,
 'provider_id',case when public.current_account_role() in ('owner','manager') then j.provider_id else null end) item
 from public.staff_notification_jobs j join public.player_profiles p on p.id=j.profile_id
 where public.staff_can_view_service_athlete(j.profile_id) and (public.current_account_role() in ('owner','manager') or j.recipient_id=auth.uid()) order by j.created_at desc limit 100) recent),'[]'::jsonb));
end;$$;
create function public.set_staff_notification_opt_out(opt_out boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if opt_out is null or public.current_account_role() is null or public.current_account_role() not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) then raise exception 'Configured staff access is required.';end if;
 update public.staff_notification_recipients set opted_out=opt_out where user_id=auth.uid() and selected;
 if not found then raise exception 'An Owner must select notification recipients first.';end if;
end;$$;
revoke all on function public.guard_staff_notification_activation(),public.operational_staff_eligible(uuid,uuid),public.operational_source(text,uuid),public.operational_recipient_allowed(uuid,text,uuid),public.staff_notification_job_allowed(public.staff_notification_jobs),public.notification_review_ready(public.review_services) from public,anon,authenticated;
revoke all on function public.observe_new_content_notices(integer),public.prepare_staff_notification_jobs(integer),public.claim_staff_notification_jobs(integer),public.authorize_staff_notification_job(uuid,uuid),public.finish_staff_notification_job(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.observe_new_content_notices(integer),public.prepare_staff_notification_jobs(integer),public.claim_staff_notification_jobs(integer),public.authorize_staff_notification_job(uuid,uuid),public.finish_staff_notification_job(uuid,uuid,text,text,text,integer) to service_role;
revoke all on function public.staff_notification_workspace(),public.set_staff_notification_opt_out(boolean) from public,anon;
grant execute on function public.staff_notification_workspace(),public.set_staff_notification_opt_out(boolean) to authenticated;
notify pgrst,'reload schema';
commit;
