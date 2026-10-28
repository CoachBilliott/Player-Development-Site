-- REVIEW DRAFT ONLY. Requires 017 plus its 012/015/016 dependencies.
-- No hosted application, public endpoint, credential or sender activation implied.
begin;

create table public.interest_intake_settings(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 window_started_at timestamptz not null default clock_timestamp(),
 accepted_in_window integer not null default 0 check(accepted_in_window>=0),
 window_limit integer not null default 10 check(window_limit between 1 and 100),
 email_daily_limit integer not null default 3 check(email_daily_limit between 1 and 10)
);
insert into public.interest_intake_settings default values;
create table public.interest_requests(
 id uuid primary key,
 adult_name text not null default '' check(length(adult_name)<=60 and adult_name!~'[[:cntrl:]]'),
 contact_email text not null check(length(contact_email)<=254 and contact_email=lower(btrim(contact_email)) and contact_email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 package_interest text not null check(package_interest in ('undecided','foundation','fundamentals','position-development','elite-coaching')),
 adult_declared_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default clock_timestamp()
);
create index interest_requests_contact_created on public.interest_requests(contact_email,created_at);
-- Immutable per-submission preferences; no legacy rows are populated.
create table public.interest_submission_events(
 submission_id uuid primary key,
 interest_id uuid not null references public.interest_requests(id) on delete cascade,
 payload_digest text not null,
 launch_requested boolean not null default false,
 notice_version text,
 notice_text text,
 recorded_at timestamptz not null default clock_timestamp(),
 check((notice_version is null and notice_text is null and not launch_requested) or
       (notice_version='repformed-launch-notice-v1' and notice_text='Email me when Repformed launches'))
);
create index interest_submission_events_history on public.interest_submission_events(interest_id,recorded_at);
alter table public.interest_submission_events enable row level security;
revoke all on public.interest_submission_events from public,anon,authenticated;

alter table public.interest_intake_settings enable row level security;
alter table public.interest_requests enable row level security;
revoke all on public.interest_intake_settings,public.interest_requests from public,anon,authenticated;

-- Shared business inbox only. Verified Owner/Manager recipient routing is future
-- work, not a selectable mode. Do not activate 017 by itself after this revision.
alter table public.staff_notification_settings add column routing_mode text not null default 'shared_inbox' check(routing_mode='shared_inbox');
alter table public.staff_notification_settings drop constraint staff_notification_settings_signup_source_check;
alter table public.staff_notification_settings add check(signup_source is null or signup_source='interest_submission');
update public.staff_notification_settings set signup_source='interest_submission';
alter table public.staff_notification_jobs drop constraint staff_notification_jobs_kind_check;
alter table public.staff_notification_jobs add check(kind in ('training_overdue','review_overdue','interest_received'));
alter table public.staff_notification_jobs alter column profile_id drop not null;
alter table public.staff_notification_jobs alter column recipient_id drop not null;
alter table public.staff_notification_jobs add column route text not null default 'legacy_staff' check(route in ('legacy_staff','shared_inbox'));
alter table public.staff_notification_jobs add check(route<>'shared_inbox' or (recipient_id is null and lower(recipient_email)='repformed@gmail.com'));
alter table public.staff_notification_jobs add check((kind='interest_received')=(profile_id is null));
create unique index shared_notification_once on public.staff_notification_jobs(kind,source_id) where route='shared_inbox';
update public.staff_notification_jobs set state='suppressed',last_code='routing_superseded' where route='legacy_staff' and state in ('queued','retry','processing');
update public.staff_notification_recipients set selected=false;

create function public.shared_notification_source(kind text,source_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare x public.interest_requests;
begin
 if kind='interest_received' then
  select * into x from public.interest_requests where id=source_id;
  if not found then return null;end if;
  return jsonb_build_object('profile_id',null,'due_at',x.created_at);
 end if;
 return public.operational_source(kind,source_id);
end;$$;

create or replace function public.prepare_staff_notification_jobs(batch_limit integer default 10) returns integer
language plpgsql security definer set search_path='' as $$
declare item record;source jsonb;cutoff timestamptz;n integer;added integer:=0;
begin
 if batch_limit is null or batch_limit not between 1 and 10 then raise exception 'Choose a batch from 1 through 10.';end if;
 select email_since into cutoff from public.staff_notification_settings where email_enabled and routing_mode='shared_inbox';
 if cutoff is null then return 0;end if;
 for item in select 'training_overdue'::text kind,id from public.delivery_expectations where state='active'
 union all select 'review_overdue',id from public.review_services where state in ('queued','in_review')
 union all select 'interest_received',id from public.interest_requests where created_at>=cutoff loop
  source:=public.shared_notification_source(item.kind,item.id);
  if source is null or (source->>'due_at')::timestamptz<cutoff or (source->>'due_at')::timestamptz>clock_timestamp() then continue;end if;
  insert into public.staff_notification_jobs(kind,profile_id,source_id,recipient_email,due_at,route)
  values(item.kind,(source->>'profile_id')::uuid,item.id,'Repformed@gmail.com',(source->>'due_at')::timestamptz,'shared_inbox')
  on conflict(kind,source_id) where route='shared_inbox' do nothing;
  get diagnostics n=row_count;added:=added+n;if added>=batch_limit then return added;end if;
 end loop;
 return added;
end;$$;
create or replace function public.staff_notification_job_allowed(job public.staff_notification_jobs) returns boolean
language sql stable security definer set search_path='' as $$
 select job.route='shared_inbox' and job.recipient_id is null and lower(job.recipient_email)='repformed@gmail.com'
 and exists(select 1 from public.staff_notification_settings where email_enabled and routing_mode='shared_inbox' and email_since<=job.created_at)
 and public.shared_notification_source(job.kind,job.source_id) is not null
 and (public.shared_notification_source(job.kind,job.source_id)->>'profile_id')::uuid is not distinct from job.profile_id
 and (public.shared_notification_source(job.kind,job.source_id)->>'due_at')::timestamptz=job.due_at
 and job.due_at<=clock_timestamp();
$$;

-- Service-only intake; the future public Edge Function supplies validated data.
-- Locking the singleton serializes duplicate and budget decisions atomically.
create function public.accept_public_interest(submission_id uuid,adult_name text,adult_email text,package_interest text,adult_confirmed boolean,launch_updates boolean default false,consent_version text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare config public.interest_intake_settings;existing public.interest_requests;event public.interest_submission_events;email text:=lower(btrim(adult_email));name text:=btrim(coalesce(adult_name,''));stamp timestamptz:=clock_timestamp();digest text;target uuid;fresh boolean:=false;
begin
 if submission_id is null or adult_confirmed is distinct from true or adult_email is null or length(email)>254 or email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or length(name)>60 or name~'[[:cntrl:]]' or package_interest is null or package_interest not in ('undecided','foundation','fundamentals','position-development','elite-coaching')
 or launch_updates is null or (consent_version is not null and consent_version<>'repformed-launch-notice-v1') or (launch_updates and consent_version is distinct from 'repformed-launch-notice-v1') then raise exception 'Invalid adult interest request.';end if;
 digest:=encode(sha256(convert_to(jsonb_build_array(name,email,package_interest,launch_updates,consent_version)::text,'UTF8')),'hex');
 select * into config from public.interest_intake_settings where singleton for update;
 if not config.enabled then return jsonb_build_object('status','disabled');end if;
 select * into event from public.interest_submission_events e where e.submission_id=accept_public_interest.submission_id;
 if found then
  if event.payload_digest<>digest then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','accepted','dispatch_id',event.interest_id);
 end if;
 -- An older request with no shown notice does not gain retroactive consent.
 select * into existing from public.interest_requests where id=submission_id;
 if found then
  if existing.contact_email<>email or existing.adult_name<>name or existing.package_interest<>package_interest or launch_updates then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','accepted','dispatch_id',existing.id);
 end if;
 if config.window_started_at<=stamp-interval '10 minutes' then
  update public.interest_intake_settings set window_started_at=stamp,accepted_in_window=0 where singleton;config.accepted_in_window:=0;
 end if;
 if config.accepted_in_window>=config.window_limit or (select count(*) from public.interest_submission_events e join public.interest_requests i on i.id=e.interest_id where i.contact_email=email and e.recorded_at>stamp-interval '24 hours')>=config.email_daily_limit then return jsonb_build_object('status','rate_limited');end if;
 select * into existing from public.interest_requests i where i.contact_email=email and i.package_interest=accept_public_interest.package_interest and i.created_at>stamp-interval '24 hours' order by created_at desc limit 1;
 if found then target:=existing.id;
 else
  target:=submission_id;fresh:=true;
  insert into public.interest_requests(id,adult_name,contact_email,package_interest) values(submission_id,name,email,package_interest);
 end if;
 insert into public.interest_submission_events(submission_id,interest_id,payload_digest,launch_requested,notice_version,notice_text)
 values(submission_id,target,digest,launch_updates,consent_version,case when consent_version is not null then 'Email me when Repformed launches' else null end);
 update public.interest_intake_settings set accepted_in_window=accepted_in_window+1 where singleton;
 if fresh and exists(select 1 from public.staff_notification_settings where email_enabled and routing_mode='shared_inbox' and email_since<=stamp) then
  insert into public.staff_notification_jobs(kind,source_id,recipient_email,due_at,route)
  select 'interest_received',id,'Repformed@gmail.com',created_at,'shared_inbox' from public.interest_requests where id=target;
 end if;
 return jsonb_build_object('status','accepted','dispatch_id',target);
end;$$;

-- One submission-triggered attempt, not a cron or an arbitrary outbox drain.
create function public.claim_interest_notification(request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.staff_notification_jobs;
begin
 select * into j from public.staff_notification_jobs where kind='interest_received' and source_id=request_id and route='shared_inbox'
 and ((state in ('queued','retry') and next_attempt_at<=clock_timestamp()) or (state='processing' and lease_until<clock_timestamp())) for update skip locked;
 if not found then return null;end if;
 if not coalesce(public.staff_notification_job_allowed(j),false) then update public.staff_notification_jobs set state='suppressed',last_code='eligibility_changed',updated_at=clock_timestamp() where id=j.id;return null;end if;
 if j.first_attempt_at<=clock_timestamp()-interval '23 hours' then update public.staff_notification_jobs set state='uncertain',last_code='retry_window_expired',updated_at=clock_timestamp() where id=j.id;return null;end if;
 if j.attempts>=4 then update public.staff_notification_jobs set state='failed',last_code='attempt_limit',updated_at=clock_timestamp() where id=j.id;return null;end if;
 update public.staff_notification_jobs set state='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() where id=j.id returning * into j;
 return jsonb_build_object('id',j.id,'kind',j.kind,'recipient_email',j.recipient_email,'lease_token',j.lease_token,'idempotency_key','repformed-staff/'||j.id::text||'/v1');
end;$$;

create function public.interest_staff_inbox() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is null or public.current_account_role() not in ('owner','manager') or public.account_is_closing(auth.uid()) or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Owner or Manager access required.';end if;
 return coalesce((select jsonb_agg(item order by created_at desc) from (select i.created_at,jsonb_build_object('id',i.id,'adult_name',i.adult_name,'email',i.contact_email,'package_interest',i.package_interest,'created_at',i.created_at,'email_state',coalesce(j.state,'disabled'),'launch_choice',case when pref.notice_version is not null then pref.launch_requested else null end,'launch_choice_at',case when pref.notice_version is not null then pref.recorded_at else null end,'launch_notice_version',pref.notice_version,'launch_requested_at',positive.recorded_at,'launch_requested_version',positive.notice_version) item from public.interest_requests i left join public.staff_notification_jobs j on j.kind='interest_received' and j.source_id=i.id and j.route='shared_inbox' left join lateral(select e.* from public.interest_submission_events e where e.interest_id=i.id order by e.recorded_at desc limit 1) pref on true left join lateral(select e.recorded_at,e.notice_version from public.interest_submission_events e join public.interest_requests original on original.id=e.interest_id where original.contact_email=i.contact_email and e.launch_requested order by e.recorded_at desc limit 1) positive on true order by i.created_at desc limit 100) recent),'[]'::jsonb);
end;$$;
create or replace function public.staff_notification_workspace() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is null or public.current_account_role() not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Staff access is required.';end if;
 return jsonb_build_object('email_enabled',(select email_enabled from public.staff_notification_settings),'inapp_observation_enabled',(select inapp_observation_enabled from public.staff_notification_settings),'signup_status','interest_submission','routing_mode','shared_inbox','recipient_label','Repformed@gmail.com','selected',false,'opted_out',false,
 'jobs',coalesce((select jsonb_agg(item order by created_at desc) from (select j.created_at,jsonb_build_object('id',j.id,'kind',j.kind,'profile_id',j.profile_id,'athlete_name',case when j.kind='interest_received' then 'New interest request' else p.nickname end,'state',j.state,'attempts',j.attempts,'due_at',j.due_at,'updated_at',j.updated_at,'code',j.last_code,'provider_id',case when public.current_account_role() in ('owner','manager') then j.provider_id else null end) item from public.staff_notification_jobs j left join public.player_profiles p on p.id=j.profile_id
 where j.route='shared_inbox' and (public.current_account_role() in ('owner','manager') or (j.profile_id is not null and public.staff_can_view_service_athlete(j.profile_id))) order by j.created_at desc limit 100) recent),'[]'::jsonb));
end;$$;
create or replace function public.set_staff_notification_opt_out(opt_out boolean) returns void
language plpgsql security definer set search_path='' as $$
begin raise exception 'Shared inbox routing has no personal recipient preferences.';end;$$;

revoke all on function public.shared_notification_source(text,uuid),public.accept_public_interest(uuid,text,text,text,boolean,boolean,text),public.claim_interest_notification(uuid) from public,anon,authenticated;
grant execute on function public.accept_public_interest(uuid,text,text,text,boolean,boolean,text),public.claim_interest_notification(uuid) to service_role;
revoke all on function public.interest_staff_inbox() from public,anon;
grant execute on function public.interest_staff_inbox() to authenticated;
notify pgrst,'reload schema';
commit;
