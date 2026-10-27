-- REVIEW DRAFT ONLY. Depends on 012. Local synthetic validation, NOT installed.
-- Preflight for a proposed group, not a durable request/upload/credit reservation.
-- No storage, retention, bucket, consent, role, payment or fulfillment changes.
begin;
create function public.preview_drill_review_group(target_profile uuid,clips jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.player_profiles; clip jsonb; clip_id uuid; drill uuid; first_drill uuid;
 ids uuid[]:='{}'; seconds numeric:=0; bytes bigint:=0; count_clips integer;
 duration numeric; size_bytes numeric; stored_count integer; capacity boolean;
begin
 if not public.can_submit_athlete_video(target_profile) then raise exception 'Review upload access is unavailable for this athlete.';end if;
 select * into strict p from public.player_profiles where id=target_profile;
 if public.account_is_closing(p.owner_id) or public.account_is_closing(auth.uid()) then raise exception 'Account deletion is in progress.';end if;
 if clips is null or jsonb_typeof(clips)<>'array' then raise exception 'Choose one to three short clips.';end if;
 count_clips:=jsonb_array_length(clips);
 if count_clips not between 1 and 3 then raise exception 'Choose one to three short clips.';end if;
 for clip in select value from jsonb_array_elements(clips) loop
  if jsonb_typeof(clip)<>'object' or jsonb_typeof(clip->'id') is distinct from 'string'
   or jsonb_typeof(clip->'training_id') is distinct from 'string'
   or jsonb_typeof(clip->'duration_seconds') is distinct from 'number'
   or jsonb_typeof(clip->'byte_size') is distinct from 'number'
   or coalesce(clip->>'media_type','') not in ('video/mp4','video/quicktime','video/webm') then raise exception 'Choose supported clips with valid duration and size.';end if;
  clip_id:=(clip->>'id')::uuid; drill:=(clip->>'training_id')::uuid;
  duration:=(clip->>'duration_seconds')::numeric; size_bytes:=(clip->>'byte_size')::numeric;
  if duration<=0 or duration>60 or size_bytes not between 1 and 41943040 or size_bytes<>trunc(size_bytes) then raise exception 'Each clip must be at most 60 seconds and 40 MB.';end if;
  if clip_id=any(ids) then raise exception 'Choose each clip once.';end if;
  if exists(select 1 from public.athlete_video_reviews where id=clip_id) then raise exception 'A clip identifier is already reserved. Refresh the draft.';end if;
  if first_drill is not null and drill<>first_drill then raise exception 'All clips must show the same athlete and drill.';end if;
  if not public.training_matches_athlete(target_profile,drill) then raise exception 'A selected drill is unavailable for this athlete.';end if;
  first_drill:=drill;ids:=array_append(ids,clip_id); seconds:=seconds+duration;bytes:=bytes+size_bytes::bigint;
 end loop;
 if seconds>180 then raise exception 'Keep the full review within three minutes total.';end if;
 select count(*)::integer into stored_count from public.athlete_video_reviews where account_id=p.owner_id;
 -- Same explicit account and global safeguards as the current upload RPC.
 -- Only a boolean is returned for global capacity, never another account's usage.
 capacity:=stored_count+count_clips<=5 and (select coalesce(sum(v.byte_size),0) from public.athlete_video_reviews v)+bytes<=314572800;
 return jsonb_build_object('preview_only',true,'grouped_submission_available',false,
 'profile_id',p.id,'training_id',first_drill,'clip_count',count_clips,'total_seconds',seconds,
 'total_bytes',bytes,'storage_capacity_available',capacity,'stored_clip_slots_available',greatest(0,5-stored_count),
 'monthly_credits_active',false,'funding','manual_pilot');
end;
$$;
revoke all on function public.preview_drill_review_group(uuid,jsonb) from public,anon;
grant execute on function public.preview_drill_review_group(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
