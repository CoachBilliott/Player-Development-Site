-- Additive migration after 001–005. No billing, public uploads or junior access.
begin;
create table public.member_training_access (
 account_id uuid primary key references public.member_accounts(user_id) on delete cascade,
 resource_ids uuid[] not null default '{}',
 video_review_enabled boolean not null default false,
 review_coach_id uuid references auth.users(id) on delete set null,
 version integer not null default 1,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.member_training_access enable row level security;
revoke all on public.member_training_access from anon,authenticated;
grant select on public.member_training_access to authenticated;
create policy "Read own training access or owner management" on public.member_training_access for select to authenticated using(account_id=auth.uid() or public.current_account_role()='owner');

create function public.set_member_training_access(target_account uuid,resources uuid[],video_enabled boolean,coach uuid,expected_version integer)
returns public.member_training_access language plpgsql security definer set search_path='' as $$
declare result public.member_training_access;
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Only Owners can assign training and review access.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target_account::text,6));
 select * into result from public.member_training_access where account_id=target_account;
 if coalesce(result.version,0) is distinct from expected_version then raise exception 'Access changed. Refresh before saving.'; end if;
 if not exists(select 1 from public.member_accounts a join auth.users u on u.id=a.user_id where a.user_id=target_account and u.email_confirmed_at is not null) then raise exception 'A verified adult account is required.'; end if;
 if resources is null or cardinality(resources)>100 or cardinality(resources)<>(select count(distinct x) from unnest(resources) x) or exists(select 1 from unnest(resources) x where not exists(select 1 from public.training_resources r where r.id=x and r.status='published' and r.visibility='member_only')) then raise exception 'Choose published protected training.'; end if;
 if video_enabled is null or (video_enabled and not exists(select 1 from public.account_roles a where a.user_id=coach and a.role in ('owner','manager','coach'))) then raise exception 'Choose an approved review coach.'; end if;
 insert into public.member_training_access(account_id,resource_ids,video_review_enabled,review_coach_id,updated_by)
 values(target_account,resources,video_enabled,case when video_enabled then coach else null end,auth.uid())
 on conflict(account_id) do update set resource_ids=excluded.resource_ids,video_review_enabled=excluded.video_review_enabled,review_coach_id=excluded.review_coach_id,updated_by=auth.uid(),updated_at=now(),version=member_training_access.version+1 returning * into result;
 return result;
end;
$$;
create function public.training_matches_athlete(target_profile uuid,resource uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_profiles p join public.member_training_access a on a.account_id=p.owner_id join public.training_resources r on r.id=any(a.resource_ids)
 where p.id=target_profile and r.id=resource and r.status='published' and r.visibility='member_only'
 and (p.age_group='18+' or exists(select 1 from public.profile_settings where under18_enabled))
 and (r.content->'ages') ? p.age_group and (r.content->'levels') ? p.experience
 and (jsonb_array_length(r.content->'positions')=0 or (r.content->'positions') ? p.position));
$$;
create function public.can_open_assigned_training(resource uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_profiles p where public.can_view_athlete(p.id) and public.training_matches_athlete(p.id,resource));
$$;
revoke all on function public.training_matches_athlete(uuid,uuid),public.can_open_assigned_training(uuid) from public,anon,authenticated;
grant execute on function public.can_open_assigned_training(uuid) to authenticated;
create policy "Members read assigned matching training" on public.training_resources for select to authenticated using(public.can_open_assigned_training(id));
create policy "Members read assigned matching media" on storage.objects for select to authenticated using(bucket_id='training-media' and exists(select 1 from public.training_resources r where r.asset_path=name and public.can_open_assigned_training(r.id)));
create function public.athlete_training_plan(target_profile uuid) returns setof public.training_resources language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.'; end if;
 return query select r.* from public.training_resources r where public.training_matches_athlete(target_profile,r.id) order by r.created_at desc limit 100;
end;
$$;

create table public.athlete_video_reviews (
 id uuid primary key,
 profile_id uuid not null references public.player_profiles(id) on delete cascade,
 account_id uuid not null references public.member_accounts(user_id) on delete cascade,
 submitted_by uuid not null references auth.users(id),
 resource_id uuid references public.training_resources(id) on delete set null,
 drill_title text not null,
 asset_path text not null unique,
 media_type text not null check(media_type in ('video/mp4','video/quicktime','video/webm')),
 byte_size bigint not null check(byte_size between 1 and 41943040),
 duration_seconds numeric not null check(duration_seconds>0 and duration_seconds<=60),
 status text not null default 'uploading' check(status in ('uploading','pending_parent','queued','reviewed')),
 feedback text not null default '' check(length(feedback)<=3000),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 version integer not null default 1
);
create index athlete_video_reviews_profile on public.athlete_video_reviews(profile_id,created_at desc);
alter table public.athlete_video_reviews enable row level security;
revoke all on public.athlete_video_reviews from anon,authenticated;
grant select on public.athlete_video_reviews to authenticated;
create function public.can_submit_athlete_video(target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.player_profiles p join public.member_training_access a on a.account_id=p.owner_id join public.account_roles c on c.user_id=a.review_coach_id
 where p.id=target_profile and public.can_view_athlete(p.id) and a.video_review_enabled and c.role in ('owner','manager','coach')
 -- Real child media requires a separate reviewed consent/retention process.
 and p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)
 and (p.owner_id=auth.uid() or exists(select 1 from public.family_athlete_controls f where f.profile_id=p.id and f.self_recording_allowed)));
$$;
create function public.can_view_athlete_video(review uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.athlete_video_reviews v where v.id=review and (
 public.can_view_athlete(v.profile_id) or (v.status in ('queued','reviewed') and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a where a.account_id=v.account_id and a.video_review_enabled and a.review_coach_id=auth.uid()))));
$$;
revoke all on function public.can_submit_athlete_video(uuid),public.can_view_athlete_video(uuid) from public,anon;
grant execute on function public.can_submit_athlete_video(uuid),public.can_view_athlete_video(uuid) to authenticated;
create policy "Private family and assigned coach video reads" on public.athlete_video_reviews for select to authenticated using(public.can_view_athlete_video(id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('athlete-review-videos','athlete-review-videos',false,41943040,array['video/mp4','video/quicktime','video/webm']);
create policy "Upload reserved private athlete video" on storage.objects for insert to authenticated with check(bucket_id='athlete-review-videos' and exists(select 1 from public.athlete_video_reviews v where v.asset_path=name and v.submitted_by=auth.uid() and v.status='uploading' and public.can_submit_athlete_video(v.profile_id)));
create policy "Read authorized private athlete video" on storage.objects for select to authenticated using(bucket_id='athlete-review-videos' and exists(select 1 from public.athlete_video_reviews v where v.asset_path=name and public.can_view_athlete_video(v.id)));
create policy "Family removes private athlete video" on storage.objects for delete to authenticated using(bucket_id='athlete-review-videos' and exists(select 1 from public.athlete_video_reviews v where v.asset_path=name and public.can_view_athlete(v.profile_id) and (v.account_id=auth.uid() or v.submitted_by=auth.uid())));

create function public.athlete_video_state(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is unavailable.'; end if;
 return jsonb_build_object('can_submit',public.can_submit_athlete_video(target_profile),'remaining_slots',greatest(0,5-(select count(*) from public.athlete_video_reviews v where v.account_id=(select owner_id from public.player_profiles where id=target_profile))),'adult_only',exists(select 1 from public.player_profiles p where p.id=target_profile and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id))),'reviews',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from (select * from public.athlete_video_reviews where profile_id=target_profile order by created_at desc limit 50) v),'[]'::jsonb));
end;
$$;
create function public.begin_athlete_video(review_id uuid,target_profile uuid,training_id uuid,media_type text,byte_size bigint,duration_seconds numeric)
returns public.athlete_video_reviews language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; result public.athlete_video_reviews; ext text;
begin
 perform pg_advisory_xact_lock(hashtextextended(review_id::text,7));
 if not public.can_submit_athlete_video(target_profile) or not public.training_matches_athlete(target_profile,training_id) then raise exception 'Video review is unavailable for this athlete or drill.'; end if;
 if media_type not in ('video/mp4','video/quicktime','video/webm') or byte_size not between 1 and 41943040 or duration_seconds<=0 or duration_seconds>60 then raise exception 'Choose a supported video up to 60 seconds and 40 MB.'; end if;
 select * into result from public.athlete_video_reviews where id=review_id;
 if found then
  if result.profile_id=target_profile and result.submitted_by=auth.uid() and result.resource_id=training_id and result.media_type=begin_athlete_video.media_type and result.byte_size=begin_athlete_video.byte_size and result.duration_seconds=begin_athlete_video.duration_seconds then return result; end if;
  raise exception 'This submission ID was already used.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('player-development-video-budget',7));
 if (select count(*) from public.athlete_video_reviews where account_id=(select owner_id from public.player_profiles where id=target_profile))>=5 or (select coalesce(sum(v.byte_size),0) from public.athlete_video_reviews v)+byte_size>314572800 then raise exception 'Video storage is full. Delete an older clip and retry.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 ext:=case media_type when 'video/mp4' then 'mp4' when 'video/quicktime' then 'mov' else 'webm' end;
 insert into public.athlete_video_reviews(id,profile_id,account_id,submitted_by,resource_id,drill_title,asset_path,media_type,byte_size,duration_seconds)
 select review_id,p.id,p.owner_id,auth.uid(),r.id,r.content->>'title',p.owner_id::text||'/'||p.id::text||'/'||review_id::text||'.'||ext,media_type,byte_size,duration_seconds from public.training_resources r where r.id=training_id returning * into result;
 return result;
end;
$$;
create function public.finish_athlete_video(review_id uuid) returns public.athlete_video_reviews language plpgsql security definer set search_path='' as $$
declare v public.athlete_video_reviews;
begin
 select * into v from public.athlete_video_reviews where id=review_id and submitted_by=auth.uid() for update;
 if not found or not public.can_submit_athlete_video(v.profile_id) or not public.training_matches_athlete(v.profile_id,v.resource_id) then raise exception 'Video permission is unavailable. Nothing was sent for review.'; end if;
 if v.status<>'uploading' then return v; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='athlete-review-videos' and o.name=v.asset_path and (o.metadata->>'size')::bigint=v.byte_size and o.metadata->>'mimetype'=v.media_type) then raise exception 'The complete upload could not be confirmed. Retry the same video.'; end if;
 update public.athlete_video_reviews set status=case when v.submitted_by<>v.account_id and exists(select 1 from public.member_accounts a where a.user_id=v.account_id and a.account_type='parent') then 'pending_parent' else 'queued' end,version=version+1 where id=v.id returning * into v;
 return v;
end;
$$;
create function public.approve_athlete_video(review_id uuid,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.athlete_video_reviews v set status='queued',version=version+1 where v.id=review_id and v.account_id=auth.uid() and public.can_view_athlete(v.profile_id) and v.status='pending_parent' and v.version=expected_version;
 if not found then raise exception 'Video approval changed. Refresh before retrying.'; end if;
end;
$$;
create function public.save_athlete_video_feedback(review_id uuid,feedback_text text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if feedback_text is null or length(btrim(feedback_text)) not between 1 and 3000 then raise exception 'Enter coaching feedback, up to 3000 characters.'; end if;
 update public.athlete_video_reviews v set feedback=btrim(feedback_text),status='reviewed',reviewed_by=auth.uid(),reviewed_at=now(),version=version+1
 where v.id=review_id and v.status in ('queued','reviewed') and v.version=expected_version and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a where a.account_id=v.account_id and a.video_review_enabled and a.review_coach_id=auth.uid());
 if not found then raise exception 'Review access or version changed. Refresh before retrying.'; end if;
end;
$$;
create function public.delete_athlete_video(review_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v public.athlete_video_reviews;
begin
 select * into v from public.athlete_video_reviews where id=review_id and public.can_view_athlete(profile_id) and (account_id=auth.uid() or submitted_by=auth.uid()) for update;
 if not found then raise exception 'This video is unavailable.'; end if;
 if exists(select 1 from storage.objects where bucket_id='athlete-review-videos' and name=v.asset_path) then raise exception 'Remove the stored video before deleting its record.'; end if;
 delete from public.athlete_video_reviews where id=v.id;
end;
$$;
revoke all on function public.set_member_training_access(uuid,uuid[],boolean,uuid,integer),public.athlete_training_plan(uuid),public.athlete_video_state(uuid),public.begin_athlete_video(uuid,uuid,uuid,text,bigint,numeric),public.finish_athlete_video(uuid),public.approve_athlete_video(uuid,integer),public.save_athlete_video_feedback(uuid,text,integer),public.delete_athlete_video(uuid) from public,anon;
grant execute on function public.set_member_training_access(uuid,uuid[],boolean,uuid,integer),public.athlete_training_plan(uuid),public.athlete_video_state(uuid),public.begin_athlete_video(uuid,uuid,uuid,text,bigint,numeric),public.finish_athlete_video(uuid),public.approve_athlete_video(uuid,integer),public.save_athlete_video_feedback(uuid,text,integer),public.delete_athlete_video(uuid) to authenticated;
create or replace function public.report_athlete_workout(workout_id uuid,target_profile uuid,requested_drills text[])
returns public.athlete_workouts language plpgsql security definer set search_path='' as $$
declare p public.player_profiles; family boolean; is_parent boolean; titles text[]; total integer; eligible integer; result public.athlete_workouts;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,4));
 if not public.can_view_athlete(target_profile) then raise exception 'This athlete is not available to your account.'; end if;
 select * into strict p from public.player_profiles where id=target_profile;
 if (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles where profile_id=p.id)) and not exists(select 1 from public.profile_settings where under18_enabled) then raise exception 'Under-18 workout recording is not open.'; end if;
 family:=exists(select 1 from public.member_accounts where user_id=p.owner_id and account_type='parent');
 is_parent:=family and p.owner_id=auth.uid();
 if p.owner_id<>auth.uid() and not exists(select 1 from public.family_athlete_controls where profile_id=p.id and self_recording_allowed) then raise exception 'The parent has paused independent workout recording.'; end if;
 if requested_drills is null or cardinality(requested_drills) not between 1 and 3 or (select count(distinct d) from unnest(requested_drills) d)<>cardinality(requested_drills) then raise exception 'Choose a valid assigned session.'; end if;
 select count(*)::integer,array_agg(r.content->>'title' order by d.ordinality),sum((r.content->>'minutes')::integer)::integer into eligible,titles,total
 from unnest(requested_drills) with ordinality d(id,ordinality) join public.training_resources r on r.id::text=d.id
 where public.training_matches_athlete(target_profile,r.id);
 if eligible<>cardinality(requested_drills) then raise exception 'This session does not match the athlete’s age, position or experience.'; end if;
 select * into result from public.athlete_workouts where id=workout_id;
 if found then
  if result.profile_id=target_profile and result.reported_by=auth.uid() and result.drill_ids=requested_drills then return result; end if;
  raise exception 'This workout ID was already used.';
 end if;
 insert into public.athlete_workouts(id,profile_id,reported_by,drill_ids,titles,minutes,status,reviewed_by,reviewed_at)
 values(workout_id,p.id,auth.uid(),requested_drills,titles,total,case when is_parent then 'approved' when family then 'pending_parent' else 'self_reported' end,case when is_parent then auth.uid() else null end,case when is_parent then now() else null end) returning * into result;
 return result;
end;
$$;

-- Storage objects must be removed through Storage before profile-data deletion.
-- Otherwise cascading metadata deletion would strand private objects in the bucket.
create function public.require_video_cleanup_before_profile_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.athlete_video_reviews v where v.profile_id=old.id) then raise exception 'Delete this athlete’s video reviews before removing their profile or member data.'; end if;
 return old;
end;
$$;
revoke all on function public.require_video_cleanup_before_profile_delete() from public,anon,authenticated;
create trigger athlete_video_cleanup_guard before delete on public.player_profiles for each row execute function public.require_video_cleanup_before_profile_delete();

notify pgrst,'reload schema';
commit;
