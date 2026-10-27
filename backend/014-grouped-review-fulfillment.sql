-- REVIEW DRAFT, NOT installed. Apply after 013 only with coordinated approval.
-- New-group creation defaults OFF. Existing quotas, manual retention and adult-only
-- media access remain unchanged. No credits, charges, emails or cleanup job.
begin;
create table public.review_group_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into public.review_group_settings default values;
alter table public.review_group_settings enable row level security;
revoke all on public.review_group_settings from public,anon,authenticated;
alter table public.review_services add column is_grouped boolean not null default false,
 add column group_manifest jsonb not null default '[]',
 add column group_submitted_at timestamptz,
 add column group_feedback text not null default '' check(length(group_feedback)<=3000),
 add column group_reviewed_by uuid references auth.users(id) on delete set null,
 add column group_erased boolean not null default false;
alter table public.athlete_video_reviews add column review_request_id uuid references public.review_services(id) on delete cascade,
 add column clip_ordinal integer check(clip_ordinal between 1 and 3),
 add constraint unique_group_clip_ordinal unique(review_request_id,clip_ordinal);
create index grouped_review_clips on public.athlete_video_reviews(review_request_id);

create function public.can_view_review_group(request_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not public.account_is_closing(auth.uid()) and exists(select 1 from public.review_services s where s.id=request_id and s.is_grouped and not public.account_is_closing(s.account_id)
 and (public.can_view_athlete(s.profile_id) or (s.group_submitted_at is not null and not s.group_erased and s.state in ('queued','in_review','delivered') and s.assigned_to=auth.uid() and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a where a.account_id=s.account_id and a.video_review_enabled))));
$$;
revoke all on function public.can_view_review_group(uuid) from public,anon,authenticated;
create function public.review_group_detail(request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.review_services;
begin
 if not public.can_view_review_group(request_id) then raise exception 'This review group is unavailable.';end if;
 select * into strict s from public.review_services where id=request_id;
 return public.review_service_payload(s)||jsonb_build_object('is_grouped',true,'group_submitted_at',s.group_submitted_at,'feedback',s.group_feedback,'erased',s.group_erased,
 'clip_count',jsonb_array_length(s.group_manifest),'total_seconds',(select coalesce(sum((c->>'duration_seconds')::numeric),0) from jsonb_array_elements(s.group_manifest) c),
 'clips',coalesce((select jsonb_agg(to_jsonb(v) order by v.clip_ordinal) from public.athlete_video_reviews v where v.review_request_id=s.id),'[]'::jsonb));
end;
$$;
create function public.create_review_group(request_id uuid,target_profile uuid,clips jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.player_profiles;s public.review_services;proposal jsonb;c jsonb;ordinal integer:=0;drill uuid;ext text;
begin
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,1414));
 if not public.can_submit_athlete_video(target_profile) then raise exception 'Review upload access is unavailable for this athlete.';end if;
 select * into strict p from public.player_profiles where id=target_profile;
 if p.owner_id is distinct from auth.uid() then raise exception 'The adult account holder must prepare this review.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.id::text,1111));
 perform pg_advisory_xact_lock(hashtextextended(p.owner_id::text,1011));
 perform pg_advisory_xact_lock(hashtextextended('player-development-video-budget',7));
 if not public.can_submit_athlete_video(p.id) or public.account_is_closing(p.owner_id) then raise exception 'Review upload access is unavailable for this athlete.';end if;
 select * into s from public.review_services where id=request_id for update;
 if found and s.is_grouped then
  if s.profile_id=p.id and s.requested_by=auth.uid() and s.group_manifest=clips and not s.group_erased then return public.review_group_detail(s.id);end if;
  raise exception 'Review draft changed or this ID is unavailable.';
 end if;
 if s.id is not null and (s.profile_id<>p.id or s.requested_by<>auth.uid() or s.state<>'requested' or s.video_id is not null) then raise exception 'This request is unavailable.';end if;
 if not exists(select 1 from public.review_group_settings where enabled) then raise exception 'Grouped review preparation is not enabled.';end if;
 proposal:=public.preview_drill_review_group(p.id,clips);
 if not (proposal->>'storage_capacity_available')::boolean then raise exception 'Not enough current storage capacity. No review or credit was reserved.';end if;
 drill:=(proposal->>'training_id')::uuid;
 if s.id is null then
  insert into public.review_services(id,account_id,profile_id,requested_by,is_grouped,group_manifest,state,assigned_to,drill_title)
  values(request_id,p.owner_id,p.id,auth.uid(),true,clips,'uploading',(select review_coach_id from public.member_training_access where account_id=p.owner_id),(select content->>'title' from public.training_resources where id=drill));
 else
  update public.review_services set is_grouped=true,group_manifest=clips,state='uploading',assigned_to=coalesce(assigned_to,(select review_coach_id from public.member_training_access where account_id=p.owner_id)),drill_title=(select content->>'title' from public.training_resources where id=drill),version=version+1,updated_at=now() where id=request_id;
 end if;
 for c in select value from jsonb_array_elements(clips) loop
  ordinal:=ordinal+1;ext:=case c->>'media_type' when 'video/mp4' then 'mp4' when 'video/quicktime' then 'mov' else 'webm' end;
  insert into public.athlete_video_reviews(id,profile_id,account_id,submitted_by,resource_id,drill_title,asset_path,media_type,byte_size,duration_seconds,review_request_id,clip_ordinal)
  values((c->>'id')::uuid,p.id,p.owner_id,auth.uid(),drill,(select content->>'title' from public.training_resources where id=drill),p.owner_id::text||'/'||p.id::text||'/'||(c->>'id')||'.'||ext,c->>'media_type',(c->>'byte_size')::bigint,(c->>'duration_seconds')::numeric,request_id,ordinal);
 end loop;
 insert into public.review_service_events(service_id,actor_id,event) values(request_id,auth.uid(),'group_draft_reserved');
 return public.review_group_detail(request_id);
end;
$$;
create function public.submit_review_group(request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.review_services; n integer;seconds numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,1414));
 select * into s from public.review_services where id=request_id and is_grouped for update;
 if not found or s.account_id is distinct from auth.uid() or not public.can_submit_athlete_video(s.profile_id) or s.group_erased then raise exception 'This review group is unavailable.';end if;
 if s.group_submitted_at is not null then return public.review_group_detail(s.id);end if;
 if s.state<>'uploading' then raise exception 'This review draft is no longer open.';end if;
 select count(*)::integer,sum(duration_seconds) into n,seconds from public.athlete_video_reviews where review_request_id=s.id;
 if n<>jsonb_array_length(s.group_manifest) or n not between 1 and 3 or seconds>180 or exists(
 select 1 from public.athlete_video_reviews v where v.review_request_id=s.id and (v.status<>'queued' or v.duration_seconds<=0 or v.duration_seconds>60 or not public.training_matches_athlete(s.profile_id,v.resource_id)
 or not exists(select 1 from storage.objects o where o.bucket_id='athlete-review-videos' and o.name=v.asset_path and (o.metadata->>'size')::bigint=v.byte_size and o.metadata->>'mimetype'=v.media_type))) then raise exception 'Upload every reserved clip completely before sending this review.';end if;
 if not exists(select 1 from public.account_roles r join auth.users u on u.id=r.user_id where r.user_id=s.assigned_to and r.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(r.user_id)) then raise exception 'A verified review coach must be assigned before sending.';end if;
 update public.review_services set state='queued',group_submitted_at=now(),ready_at=coalesce(ready_at,now()),due_at=coalesce(due_at,now()+interval '48 hours'),updated_at=now(),version=version+1 where id=s.id;
 insert into public.review_service_events(service_id,actor_id,event) values(s.id,auth.uid(),'group_submitted');
 return public.review_group_detail(s.id);
end;
$$;
create function public.start_review_group(request_id uuid,expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.review_services;
begin
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,1414));
 select * into s from public.review_services where id=request_id and is_grouped for update;
 if not found or s.assigned_to is distinct from auth.uid() or public.current_account_role() not in ('owner','manager','coach') or not public.can_view_review_group(s.id) or s.group_erased then raise exception 'Assigned coach access is required.';end if;
 if s.state in ('in_review','delivered') then return public.review_group_detail(s.id);end if;
 if s.state<>'queued' or s.version<>expected_version then raise exception 'Review changed. Refresh before starting.';end if;
 update public.review_services set state='in_review',version=version+1,updated_at=now() where id=s.id;
 insert into public.review_service_events(service_id,actor_id,event) values(s.id,auth.uid(),'group_coach_started');
 return public.review_group_detail(s.id);
end;
$$;
create function public.save_review_group_feedback(request_id uuid,feedback_text text,expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.review_services;
begin
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,1414));
 select * into s from public.review_services where id=request_id and is_grouped for update;
 if not found or s.assigned_to is distinct from auth.uid() or public.current_account_role() not in ('owner','manager','coach') or not public.can_view_review_group(s.id) or s.group_erased or s.state not in ('queued','in_review','delivered') then raise exception 'Assigned coach access is required.';end if;
 if feedback_text is null or length(btrim(feedback_text)) not between 1 and 3000 then raise exception 'Enter coaching feedback, up to 3000 characters.';end if;
 if s.state='delivered' and s.group_reviewed_by=auth.uid() and s.group_feedback=btrim(feedback_text) then return public.review_group_detail(s.id);end if;
 if s.version<>expected_version then raise exception 'Review changed. Refresh before sending feedback.';end if;
 update public.review_services set group_feedback=btrim(feedback_text),group_reviewed_by=auth.uid(),state='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now(),version=version+1 where id=s.id;
 update public.athlete_video_reviews set status='reviewed',reviewed_by=auth.uid(),reviewed_at=now(),version=version+1 where review_request_id=s.id;
 insert into public.review_service_events(service_id,actor_id,event) values(s.id,auth.uid(),'group_feedback_saved');
 return public.review_group_detail(s.id);
end;
$$;
create function public.delete_review_group(request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.review_services;
begin
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,1414));
 select * into s from public.review_services where id=request_id and is_grouped for update;
 if not found or s.account_id is distinct from auth.uid() or not public.can_view_athlete(s.profile_id) then raise exception 'This review group is unavailable.';end if;
 if exists(select 1 from public.athlete_video_reviews v join storage.objects o on o.bucket_id='athlete-review-videos' and o.name=v.asset_path where v.review_request_id=s.id) then raise exception 'Remove the stored clips before deleting the review.';end if;
 delete from public.athlete_video_reviews where review_request_id=s.id;
 update public.review_services set group_erased=true,group_manifest='[]',group_feedback='',state=case when state='delivered' then 'delivered' else 'cancelled' end,version=version+1,updated_at=now() where id=s.id and not group_erased;
end;
$$;
revoke all on function public.review_group_detail(uuid),public.create_review_group(uuid,uuid,jsonb),public.submit_review_group(uuid),public.start_review_group(uuid,integer),public.save_review_group_feedback(uuid,text,integer),public.delete_review_group(uuid) from public,anon;
grant execute on function public.review_group_detail(uuid),public.create_review_group(uuid,uuid,jsonb),public.submit_review_group(uuid),public.start_review_group(uuid,integer),public.save_review_group_feedback(uuid,text,integer),public.delete_review_group(uuid) to authenticated;

create or replace function public.sync_video_review_service() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.review_services; ready timestamptz;
begin
 if (case when tg_op='DELETE' then old.review_request_id else new.review_request_id end) is not null then
  if tg_op='DELETE' then
   update public.review_services set group_erased=true,group_manifest='[]',group_feedback='',state=case when state='delivered' then 'delivered' else 'cancelled' end,version=version+1,updated_at=now() where id=old.review_request_id;
   return old;
  end if;
  return new;
 end if;
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
create or replace function public.can_view_athlete_video(review uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not public.account_is_closing(auth.uid()) and exists(select 1 from public.athlete_video_reviews v where v.id=review and not public.account_is_closing(v.account_id) and not public.account_is_closing(v.submitted_by)
 and (public.can_view_athlete(v.profile_id) or (v.status in ('queued','reviewed') and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a join public.review_services s on s.account_id=a.account_id where a.account_id=v.account_id and a.video_review_enabled and ((v.review_request_id is null and s.video_id=v.id) or (s.id=v.review_request_id and s.is_grouped and s.group_submitted_at is not null and not s.group_erased and s.state in ('queued','in_review','delivered'))) and s.assigned_to=auth.uid()))));
$$;
create or replace function public.save_athlete_video_feedback(review_id uuid,feedback_text text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.athlete_video_reviews where id=review_id and review_request_id is not null) then raise exception 'Send feedback to the complete review group.';end if;
 if feedback_text is null or length(btrim(feedback_text)) not between 1 and 3000 then raise exception 'Enter coaching feedback, up to 3000 characters.';end if;
 update public.athlete_video_reviews v set feedback=btrim(feedback_text),status='reviewed',reviewed_by=auth.uid(),reviewed_at=now(),version=version+1
 where v.id=review_id and v.status in ('queued','reviewed') and v.version=expected_version and public.can_view_athlete_video(v.id) and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.review_services s where s.video_id=v.id and s.assigned_to=auth.uid());
 if not found then raise exception 'Review access or version changed. Refresh before retrying.';end if;
end;
$$;
create or replace function public.review_service_payload(s public.review_services) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('is_grouped',s.is_grouped,'group_erased',s.group_erased,'clip_count',case when s.is_grouped then jsonb_array_length(s.group_manifest) when s.video_id is not null then 1 else 0 end,'uploaded_clips',case when s.is_grouped then (select count(*) from public.athlete_video_reviews v where v.review_request_id=s.id and v.status in ('queued','reviewed')) else 0 end,'id',s.id,'account_id',s.account_id,'profile_id',s.profile_id,'video_id',s.video_id,'assigned_to',s.assigned_to,'drill_title',s.drill_title,'state',s.state,'funding',s.funding,'blocker',s.blocker,'ready_at',s.ready_at,'due_at',s.due_at,'delivered_at',s.delivered_at,'created_at',s.created_at,'updated_at',s.updated_at,'version',s.version);
$$;
create or replace function public.athlete_video_state(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.';end if;
 return jsonb_build_object('service_tracking',true,'grouped_reviews_ready',coalesce((select enabled from public.review_group_settings),false) and (select owner_id=auth.uid() from public.player_profiles where id=target_profile) and public.can_submit_athlete_video(target_profile),'groups',coalesce((select jsonb_agg(public.review_group_detail(s.id) order by s.created_at desc) from public.review_services s where s.profile_id=target_profile and s.is_grouped),'[]'::jsonb),'can_submit',public.can_submit_athlete_video(target_profile),'remaining_slots',greatest(0,5-(select count(*) from public.athlete_video_reviews v where v.account_id=(select owner_id from public.player_profiles where id=target_profile))),'adult_only',exists(select 1 from public.player_profiles p where p.id=target_profile and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id))),'reviews',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from (select * from public.athlete_video_reviews where profile_id=target_profile order by created_at desc limit 50) v),'[]'::jsonb),'services',public.my_review_services(target_profile));
end;
$$;
create or replace function public.delete_athlete_video(review_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v public.athlete_video_reviews; grouped uuid;
begin
 select review_request_id into grouped from public.athlete_video_reviews where id=review_id;
 if grouped is not null then perform pg_advisory_xact_lock(hashtextextended(grouped::text,1414));end if;
 select * into v from public.athlete_video_reviews where id=review_id and public.can_view_athlete(profile_id) and (account_id=auth.uid() or submitted_by=auth.uid()) for update;
 if not found then raise exception 'This video is unavailable.'; end if;
 if exists(select 1 from storage.objects where bucket_id='athlete-review-videos' and name=v.asset_path) then raise exception 'Remove the stored video before deleting its record.'; end if;
 delete from public.athlete_video_reviews where id=v.id;
end;
$$;
notify pgrst,'reload schema';
commit;
