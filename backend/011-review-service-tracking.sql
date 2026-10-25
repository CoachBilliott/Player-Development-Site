-- Additive, private fulfillment only. No billing, checkout, credits or junior media.
begin;
create table public.review_services (
 id uuid primary key,
 account_id uuid not null references public.member_accounts(user_id) on delete cascade,
 profile_id uuid not null references public.player_profiles(id) on delete cascade,
 video_id uuid unique references public.athlete_video_reviews(id) on delete set null,
 requested_by uuid references auth.users(id) on delete set null,
 assigned_to uuid references auth.users(id) on delete set null,
 drill_title text not null default 'One drill review',
 state text not null default 'requested' check(state in ('requested','uploading','pending_parent','queued','in_review','delivered','cancelled')),
 funding text not null default 'manual_pilot' check(funding='manual_pilot'),
 blocker text not null default 'none' check(blocker in ('none','access_needed','customer_follow_up','technical_issue')),
 ready_at timestamptz,
 due_at timestamptz,
 delivered_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version integer not null default 1
);
create unique index review_services_one_request on public.review_services(profile_id) where state='requested';
create index review_services_due on public.review_services(state,due_at);
create table public.review_service_events (
 id bigint generated always as identity primary key,
 service_id uuid not null references public.review_services(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 event text not null,
 created_at timestamptz not null default now()
);
alter table public.review_services enable row level security;
alter table public.review_service_events enable row level security;
revoke all on public.review_services,public.review_service_events from anon,authenticated;
-- All reads use narrow RPC projections. Operational access does not expose clips or profiles.
create function public.review_service_payload(s public.review_services) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'account_id',s.account_id,'profile_id',s.profile_id,'video_id',s.video_id,'assigned_to',s.assigned_to,'drill_title',s.drill_title,'state',s.state,'funding',s.funding,'blocker',s.blocker,'ready_at',s.ready_at,'due_at',s.due_at,'delivered_at',s.delivered_at,'created_at',s.created_at,'updated_at',s.updated_at,'version',s.version);
$$;
create function public.request_drill_review(request_id uuid,target_profile uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; s public.review_services;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,1111));
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 select * into strict p from public.player_profiles where id=target_profile;
 perform pg_advisory_xact_lock(hashtextextended(p.owner_id::text,1011));
 if public.account_is_closing(p.owner_id) then raise exception 'Account deletion is in progress.';end if;
 if p.owner_id<>auth.uid() or p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles where profile_id=p.id) then raise exception 'An adult account holder is required. Junior requests are not open.';end if;
 select * into s from public.review_services where id=request_id;
 if found then
  if s.profile_id<>target_profile or s.requested_by<>auth.uid() then raise exception 'Request ID is unavailable.';end if;
  return public.review_service_payload(s);
 end if;
 select * into s from public.review_services where profile_id=target_profile and state='requested';
 if found then return public.review_service_payload(s);end if;
 insert into public.review_services(id,account_id,profile_id,requested_by,blocker)
 values(request_id,p.owner_id,p.id,auth.uid(),case when public.can_submit_athlete_video(p.id) then 'none' else 'access_needed' end) returning * into s;
 insert into public.review_service_events(service_id,actor_id,event) values(s.id,auth.uid(),'customer_requested');
 return public.review_service_payload(s);
end;
$$;
create function public.cancel_drill_review(request_id uuid,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.review_services s set state='cancelled',updated_at=now(),version=version+1
 where s.id=request_id and s.state='requested' and s.version=expected_version and s.account_id=auth.uid() and public.can_view_athlete(s.profile_id);
 if not found then raise exception 'Request changed. Refresh before cancelling.';end if;
 insert into public.review_service_events(service_id,actor_id,event) values(request_id,auth.uid(),'customer_cancelled');
end;
$$;
create function public.my_review_services(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 return coalesce((select jsonb_agg(public.review_service_payload(s) order by s.created_at desc) from (select * from public.review_services where profile_id=target_profile order by created_at desc limit 100) s),'[]'::jsonb);
end;
$$;
create function public.review_service_desk() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(public.current_account_role(),'') not in ('owner','manager') or public.account_is_closing(auth.uid()) then raise exception 'Owner or Manager access is required.';end if;
 return jsonb_build_object('requests',coalesce((select jsonb_agg(public.review_service_payload(s) order by s.created_at desc) from public.review_services s where not public.account_is_closing(s.account_id)),'[]'::jsonb),
 'staff',coalesce((select jsonb_agg(jsonb_build_object('id',r.user_id,'label',u.email,'role',r.role) order by u.email) from public.account_roles r join auth.users u on u.id=r.user_id where r.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(r.user_id)),'[]'::jsonb));
end;
$$;
create function public.manage_review_service(request_id uuid,coach uuid,blocker_code text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare s public.review_services;
begin
 if coalesce(public.current_account_role(),'') not in ('owner','manager') or public.account_is_closing(auth.uid()) then raise exception 'Owner or Manager access is required.';end if;
 if blocker_code is null or blocker_code not in ('none','access_needed','customer_follow_up','technical_issue') then raise exception 'Choose a valid follow-up.';end if;
 if coach is not null and not exists(select 1 from public.account_roles r join auth.users u on u.id=r.user_id where r.user_id=coach and r.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(r.user_id)) then raise exception 'Choose an approved coach.';end if;
 select * into s from public.review_services where id=request_id for update;
 if not found or s.version<>expected_version or s.state in ('delivered','cancelled') or public.account_is_closing(s.account_id) then raise exception 'Request changed. Refresh before saving.';end if;
 update public.review_services set assigned_to=coach,blocker=blocker_code,updated_at=now(),version=version+1 where id=s.id;
 insert into public.review_service_events(service_id,actor_id,event) values(s.id,auth.uid(),'assignment_or_follow_up_updated');
end;
$$;
create function public.start_drill_review(review_id uuid,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.review_services s set state='in_review',updated_at=now(),version=version+1 where s.video_id=review_id and s.state='queued' and exists(select 1 from public.athlete_video_reviews v where v.id=review_id and v.version=expected_version) and s.assigned_to=auth.uid() and public.current_account_role() in ('owner','manager','coach') and public.can_view_athlete_video(review_id);
 if not found then
  if exists(select 1 from public.review_services s join public.athlete_video_reviews v on v.id=s.video_id where s.video_id=review_id and s.state='in_review' and s.assigned_to=auth.uid() and v.version=expected_version and public.can_view_athlete_video(review_id)) then return;end if;
  raise exception 'Review changed. Refresh before starting.';end if;
 insert into public.review_service_events(service_id,actor_id,event) select id,auth.uid(),'coach_started' from public.review_services where video_id=review_id;
end;
$$;
create function public.sync_video_review_service() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.review_services; ready timestamptz;
begin
 if tg_op='DELETE' then
  update public.review_services set state=case when state='delivered' then 'delivered' else 'cancelled' end,updated_at=now(),version=version+1 where video_id=old.id;
  return old;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text,1111));
 select * into s from public.review_services where video_id=new.id for update;
 if not found then
  select * into s from public.review_services where profile_id=new.profile_id and state='requested' for update;
  if not found then
   insert into public.review_services(id,account_id,profile_id,video_id,requested_by,assigned_to,drill_title,state)
   values(new.id,new.account_id,new.profile_id,new.id,new.submitted_by,(select review_coach_id from public.member_training_access where account_id=new.account_id),new.drill_title,case when new.status='reviewed' then 'delivered' else new.status end) returning * into s;
  else
   update public.review_services set video_id=new.id,drill_title=new.drill_title,assigned_to=coalesce(assigned_to,(select review_coach_id from public.member_training_access where account_id=new.account_id)) where id=s.id returning * into s;
  end if;
 end if;
 -- Start the fixed 48-hour target only after a complete upload and any parent approval.
 ready:=case when new.status in ('queued','reviewed') then coalesce(s.ready_at,new.reviewed_at,now()) else s.ready_at end;
 update public.review_services set state=case when new.status='reviewed' then 'delivered' when new.status='queued' and s.state='in_review' then 'in_review' else new.status end,
 ready_at=ready,due_at=case when ready is not null then coalesce(s.due_at,ready+interval '48 hours') else null end,
 delivered_at=case when new.status='reviewed' then coalesce(s.delivered_at,new.reviewed_at,now()) else s.delivered_at end,
 blocker=case when s.blocker='access_needed' then 'none' else s.blocker end,updated_at=now(),version=version+1 where id=s.id;
 if tg_op='INSERT' or old.status is distinct from new.status then
  insert into public.review_service_events(service_id,actor_id,event) values(s.id,auth.uid(),'video_'||new.status);
 end if;
 return new;
end;
$$;
create trigger sync_video_service after insert or update on public.athlete_video_reviews for each row execute function public.sync_video_review_service();
create trigger remove_video_service before delete on public.athlete_video_reviews for each row execute function public.sync_video_review_service();
-- Existing submissions receive the same metadata; never reset a clock on reassignment or refresh.
insert into public.review_services(id,account_id,profile_id,video_id,requested_by,assigned_to,drill_title,state,ready_at,due_at,delivered_at,created_at)
select v.id,v.account_id,v.profile_id,v.id,v.submitted_by,a.review_coach_id,v.drill_title,case when v.status='reviewed' then 'delivered' else v.status end,
case when v.status in ('queued','reviewed') then v.created_at end,case when v.status in ('queued','reviewed') then v.created_at+interval '48 hours' end,v.reviewed_at,v.created_at
from public.athlete_video_reviews v left join public.member_training_access a on a.account_id=v.account_id;

-- Assignment grants access only to this ready clip, with existing account freezes and access switch.
create or replace function public.can_view_athlete_video(review uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not public.account_is_closing(auth.uid()) and exists(select 1 from public.athlete_video_reviews v where v.id=review and not public.account_is_closing(v.account_id) and not public.account_is_closing(v.submitted_by)
 and (public.can_view_athlete(v.profile_id) or (v.status in ('queued','reviewed') and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a join public.review_services s on s.account_id=a.account_id where a.account_id=v.account_id and a.video_review_enabled and s.video_id=v.id and s.assigned_to=auth.uid()))));
$$;
create or replace function public.save_athlete_video_feedback(review_id uuid,feedback_text text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if feedback_text is null or length(btrim(feedback_text)) not between 1 and 3000 then raise exception 'Enter coaching feedback, up to 3000 characters.';end if;
 update public.athlete_video_reviews v set feedback=btrim(feedback_text),status='reviewed',reviewed_by=auth.uid(),reviewed_at=now(),version=version+1
 where v.id=review_id and v.status in ('queued','reviewed') and v.version=expected_version and public.can_view_athlete_video(v.id) and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.review_services s where s.video_id=v.id and s.assigned_to=auth.uid());
 if not found then raise exception 'Review access or version changed. Refresh before retrying.';end if;
end;
$$;
-- Additive fields keep older clients working.
create or replace function public.athlete_video_state(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 return jsonb_build_object('service_tracking',true,'can_submit',public.can_submit_athlete_video(target_profile),'remaining_slots',greatest(0,5-(select count(*) from public.athlete_video_reviews v where v.account_id=(select owner_id from public.player_profiles where id=target_profile))),'adult_only',exists(select 1 from public.player_profiles p where p.id=target_profile and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id))),'reviews',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from (select * from public.athlete_video_reviews where profile_id=target_profile order by created_at desc limit 50) v),'[]'::jsonb),'services',public.my_review_services(target_profile));
end;
$$;
revoke all on function public.review_service_payload(public.review_services),public.sync_video_review_service() from public,anon,authenticated;
revoke all on function public.request_drill_review(uuid,uuid),public.cancel_drill_review(uuid,integer),public.my_review_services(uuid),public.review_service_desk(),public.manage_review_service(uuid,uuid,text,integer),public.start_drill_review(uuid,integer) from public,anon;
grant execute on function public.request_drill_review(uuid,uuid),public.cancel_drill_review(uuid,integer),public.my_review_services(uuid),public.review_service_desk(),public.manage_review_service(uuid,uuid,text,integer),public.start_drill_review(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
