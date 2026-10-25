-- Apply once after 009. Private adult invitations and verified customer erasure.
-- No signup, junior, billing, SMTP or existing role settings are opened here.
begin;

create table public.account_onboarding_settings (
 singleton boolean primary key default true check(singleton),
 legacy_before timestamptz not null default now()
);
insert into public.account_onboarding_settings default values;
alter table public.account_onboarding_settings enable row level security;
revoke all on public.account_onboarding_settings from public,anon,authenticated;

create table public.account_invitations (
 id uuid primary key,
 email text not null check(email=lower(btrim(email)) and length(email) between 3 and 254),
 intended_role text not null check(intended_role in ('manager','coach','parent','athlete')),
 invited_by uuid references auth.users(id) on delete set null,
 target_user uuid references auth.users(id) on delete cascade,
 state text not null default 'preparing' check(state in ('preparing','sent','failed','accepted','cancelled','expired')),
 delivery_code text not null default '',
 attempts integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,
 version integer not null default 1
);
create unique index one_active_account_invite_per_email on public.account_invitations(email) where state in ('preparing','sent');
alter table public.account_invitations enable row level security;
revoke all on public.account_invitations from public,anon,authenticated;

create table public.account_closures (
 id uuid primary key,
 user_id uuid unique references auth.users(id) on delete set null,
 state text not null check(state in ('cleaning','failed','completed','assistance_requested','assistance_reviewed')),
 reason text not null default '',
 profile_count integer not null default 0,
 video_count integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.account_closures enable row level security;
revoke all on public.account_closures from public,anon,authenticated;

create function public.account_is_closing(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.account_closures where user_id=target and state in ('cleaning','failed'));
$$;
revoke all on function public.account_is_closing(uuid) from public,anon,authenticated;

create function public.account_closure_reason(target uuid) returns text
language sql stable security definer set search_path='' as $$
 select case
 when exists(select 1 from public.account_roles where user_id=target and role='owner') then 'owner_transfer'
 when exists(select 1 from public.account_roles where user_id=target and role in ('manager','coach'))
   or exists(select 1 from public.training_resources where created_by=target)
   or exists(select 1 from public.training_workouts where created_by=target)
   or exists(select 1 from storage.objects where bucket_id='training-media' and split_part(name,'/',1)=target::text) then 'staff_content'
 when exists(select 1 from public.guardian_managed_athletes where user_id=target)
   or exists(select 1 from public.player_profiles p where p.owner_id=target and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)))
   or exists(select 1 from public.family_athlete_links l join public.player_profiles p on p.id=l.profile_id where l.athlete_user_id=target and (p.age_group<>'18+' or exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id))) then 'guardian_review'
 else '' end;
$$;
revoke all on function public.account_closure_reason(uuid) from public,anon,authenticated;

create function public.account_lifecycle_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); reason text; job public.account_closures;
begin
 if u is null then raise exception 'Sign in first.';end if;
 reason:=public.account_closure_reason(u);
 select * into job from public.account_closures where user_id=u;
 return jsonb_build_object('eligible',reason='','reason',reason,'request_id',job.id,'state',coalesce(job.state,'none'),
  'profile_count',(select count(*) from public.player_profiles where owner_id=u),
  'video_count',(select count(*) from public.athlete_video_reviews where account_id=u or submitted_by=u));
end;
$$;
revoke all on function public.account_lifecycle_state() from public,anon;
grant execute on function public.account_lifecycle_state() to authenticated;

create function public.list_account_invitations() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.';end if;
 return coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from
 (select id,email,intended_role,state,delivery_code,created_at,updated_at,expires_at,version from public.account_invitations order by created_at desc limit 100) i),'[]'::jsonb);
end;
$$;
revoke all on function public.list_account_invitations() from public,anon;
grant execute on function public.list_account_invitations() to authenticated;

-- Only the server can reserve/send an invitation. A stable ID limits repeat sends.
create function public.begin_account_invitation(actor uuid,invitation uuid,target_email text,target_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.account_invitations; normalized text:=lower(btrim(target_email)); verified_user uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(normalized,1010));
 if not exists(select 1 from public.account_roles where user_id=actor and role='owner') then raise exception 'Owner access is required.';end if;
 if normalized is null or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized)>254 or target_role not in ('manager','coach','parent','athlete') then raise exception 'Choose a valid adult email and invitation level.';end if;
 select * into i from public.account_invitations where id=invitation for update;
 if found then
  if i.email<>normalized or i.intended_role<>target_role or i.invited_by<>actor then raise exception 'Invitation ID already used.';end if;
  if i.state<>'failed' or i.updated_at>now()-interval '60 seconds' then return jsonb_build_object('deliver',false,'invitation',to_jsonb(i));end if;
  if i.attempts>=5 then raise exception 'Too many delivery attempts. Ask the Owner to check email configuration.';end if;
  update public.account_invitations set state='preparing',delivery_code='',attempts=attempts+1,updated_at=now(),version=version+1 where id=i.id returning * into i;
 else
  update public.account_invitations set state='expired',version=version+1,updated_at=now() where email=normalized and state in ('preparing','sent') and expires_at<=now();
  if exists(select 1 from public.account_invitations where email=normalized and state in ('preparing','sent')) then raise exception 'An invitation is already pending. Refresh invitations.';end if;
  if (select count(*) from public.account_invitations where invited_by=actor and created_at>now()-interval '1 hour')>=10 then raise exception 'Invitation limit reached. Wait before inviting more people.';end if;
  select id into verified_user from auth.users where lower(email)=normalized and email_confirmed_at is not null;
  if verified_user is not null and (exists(select 1 from public.account_roles where user_id=verified_user) or exists(select 1 from public.member_accounts where user_id=verified_user)) then raise exception 'This account already exists. Use Manage account access.';end if;
  insert into public.account_invitations(id,email,intended_role,invited_by,target_user,state,delivery_code)
   values(invitation,normalized,target_role,actor,verified_user,case when verified_user is null then 'preparing' else 'sent' end,case when verified_user is null then '' else 'existing_account' end) returning * into i;
  if verified_user is not null then return jsonb_build_object('deliver',false,'invitation',to_jsonb(i));end if;
 end if;
 return jsonb_build_object('deliver',true,'invitation',to_jsonb(i));
end;
$$;

create function public.finish_account_invitation(invitation uuid,recipient uuid,result_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.account_invitations;
begin
 select * into strict i from public.account_invitations where id=invitation for update;
 if i.state='accepted' then return jsonb_build_object('id',i.id,'state',i.state,'delivery_code',i.delivery_code);end if;
 if recipient is not null and not exists(select 1 from auth.users where id=recipient and lower(email)=i.email) then raise exception 'Invitation recipient mismatch.';end if;
 if result_code not in ('sent','mail_setup_required','delivery_unconfirmed','account_exists') then raise exception 'Invalid delivery result.';end if;
 update public.account_invitations set target_user=coalesce(recipient,target_user),
  state=case when state='cancelled' then 'cancelled' when result_code='sent' then 'sent' else 'failed' end,
  delivery_code=result_code,updated_at=now(),version=version+1 where id=i.id returning * into i;
 return jsonb_build_object('id',i.id,'state',i.state,'delivery_code',i.delivery_code);
end;
$$;

create function public.cancel_account_invitation(invitation uuid,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare i public.account_invitations;
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.';end if;
 select * into strict i from public.account_invitations where id=invitation for update;
 if i.state='cancelled' and i.version=expected_version+1 then return;end if;
 if i.version<>expected_version or i.state='accepted' then raise exception 'Invitation changed. Refresh before cancelling.';end if;
 update public.account_invitations set state='cancelled',version=version+1,updated_at=now() where id=i.id;
end;
$$;
revoke all on function public.cancel_account_invitation(uuid,integer) from public,anon;
grant execute on function public.cancel_account_invitation(uuid,integer) to authenticated;

create function public.my_account_invitation() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.account_invitations;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 if exists(select 1 from public.account_roles where user_id=auth.uid()) then return null;end if;
 select * into i from public.account_invitations where target_user=auth.uid() and state<>'accepted' order by created_at desc limit 1;
 if not found then return null;end if;
 return jsonb_build_object('id',i.id,'intended_role',i.intended_role,'state',case when i.expires_at<=now() then 'expired' else i.state end,'expires_at',i.expires_at);
end;
$$;
revoke all on function public.my_account_invitation() from public,anon;
grant execute on function public.my_account_invitation() to authenticated;

create function public.accept_account_invitation(invitation uuid,adult_confirmed boolean,privacy_acknowledged boolean) returns void
language plpgsql security definer set search_path='' as $$
declare i public.account_invitations; u uuid:=auth.uid(); existing_level text;
begin
 select * into strict i from public.account_invitations where id=invitation and target_user=u for update;
 if i.state='accepted' then return;end if;
 if i.state<>'sent' or i.expires_at<=now() or adult_confirmed is distinct from true or privacy_acknowledged is distinct from true then raise exception 'A valid invitation, adult confirmation and privacy acknowledgement are required.';end if;
 if not exists(select 1 from auth.users where id=u and lower(email)=i.email and email_confirmed_at is not null) then raise exception 'Verify the invited email first.';end if;
 if not exists(select 1 from public.account_roles where user_id=i.invited_by and role='owner') then raise exception 'The inviting Owner no longer has access. Request another invitation.';end if;
 if exists(select 1 from public.guardian_managed_athletes where user_id=u) or exists(select 1 from public.family_athlete_links where athlete_user_id=u and revoked_at is null) or public.account_is_closing(u) then raise exception 'This account needs an Owner review before changing access.';end if;
 select role into existing_level from public.account_roles where user_id=u;
 if existing_level is not null then raise exception 'This account already has access. Ask an Owner to review it.';end if;
 insert into public.member_accounts(user_id,account_type,privacy_version) values(u,case when i.intended_role='parent' then 'parent' else 'adult' end,'adult-pilot-lifecycle-2026-10');
 insert into public.account_roles(user_id,role) values(u,i.intended_role);
 update public.account_invitations set state='accepted',accepted_at=now(),updated_at=now(),version=version+1 where id=i.id;
end;
$$;
revoke all on function public.accept_account_invitation(uuid,boolean,boolean) from public,anon;
grant execute on function public.accept_account_invitation(uuid,boolean,boolean) to authenticated;

-- A cancelled invite must not fall through to the ordinary member-setup RPC.
alter function public.complete_member_account(text,boolean,boolean) rename to complete_member_account_pre_lifecycle_v9;
revoke all on function public.complete_member_account_pre_lifecycle_v9(text,boolean,boolean) from public,anon,authenticated;
create function public.complete_member_account(kind text,adult_confirmed boolean,privacy_acknowledged boolean)
returns public.member_accounts language plpgsql security definer set search_path='' as $$
begin
 if public.account_is_closing(auth.uid()) then raise exception 'Account deletion is in progress.';end if;
 if not exists(select 1 from public.member_accounts where user_id=auth.uid())
  and not exists(select 1 from auth.users u cross join public.account_onboarding_settings s where u.id=auth.uid() and u.created_at<s.legacy_before)
  and not exists(select 1 from public.account_invitations where target_user=auth.uid() and state='accepted')
 then raise exception 'Accept an active Owner invitation before completing setup.';end if;
 return public.complete_member_account_pre_lifecycle_v9(kind,adult_confirmed,privacy_acknowledged);
end;
$$;
revoke all on function public.complete_member_account(text,boolean,boolean) from public,anon;
grant execute on function public.complete_member_account(text,boolean,boolean) to authenticated;

create function public.begin_account_closure(target uuid,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.account_closures; reason text;
begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,1011));
 if not exists(select 1 from auth.users where id=target) then raise exception 'Account is unavailable.';end if;
 reason:=public.account_closure_reason(target);
 if reason<>'' then raise exception 'Assisted account closure is required: %',reason;end if;
 select * into job from public.account_closures where user_id=target for update;
 if found and job.state in ('cleaning','failed') then return to_jsonb(job);end if;
 if found then delete from public.account_closures where id=job.id;end if;
 insert into public.account_closures(id,user_id,state,profile_count,video_count)
 values(request_id,target,'cleaning',(select count(*) from public.player_profiles where owner_id=target),
 (select count(*) from public.athlete_video_reviews where account_id=target or submitted_by=target)) returning * into job;
 return to_jsonb(job);
end;
$$;

-- Return only paths authorized for this deletion, never arbitrary client paths.
create function public.account_closure_media(target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.account_is_closing(target) then raise exception 'Start deletion first.';end if;
 return coalesce((select jsonb_agg(path) from
 (select asset_path as path from public.athlete_video_reviews where account_id=target or submitted_by=target
 union select name from storage.objects where bucket_id='athlete-review-videos' and split_part(name,'/',1)=target::text) paths),'[]'::jsonb);
end;
$$;

create function public.clear_account_closure_data(target uuid,request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare email_address text;
begin
 perform pg_advisory_xact_lock(hashtextextended(target::text,1011));
 if not exists(select 1 from public.account_closures where user_id=target and id=request_id and state in ('cleaning','failed')) or public.account_closure_reason(target)<>'' then raise exception 'Account deletion needs review.';end if;
 if exists(select 1 from storage.objects o where o.bucket_id='athlete-review-videos' and
 (split_part(o.name,'/',1)=target::text or exists(select 1 from public.athlete_video_reviews v where v.asset_path=o.name and (v.account_id=target or v.submitted_by=target)))) then raise exception 'Stored media cleanup has not finished.';end if;
 select lower(email) into email_address from auth.users where id=target;
 delete from public.athlete_video_reviews where account_id=target or submitted_by=target;
 delete from public.practice_resumes where user_id=target;
 delete from public.account_invitations where target_user=target or email=email_address;
 delete from public.member_accounts where user_id=target;
 -- Other households' profiles/history remain; Auth erasure clears reporter FKs.
 update public.account_closures set state='cleaning',reason='',updated_at=now() where id=request_id;
end;
$$;

create function public.finish_account_closure(request_id uuid,failed boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.account_closures set state=case when failed then 'failed' else 'completed' end,
 reason=case when failed then 'retry_required' else '' end,updated_at=now()
 where id=request_id and state in ('cleaning','failed')
 and (failed or user_id is null);
 if not found then raise exception 'Authentication deletion is not confirmed.';end if;
end;
$$;

create function public.request_account_closure_help() returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;reason text;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 reason:=public.account_closure_reason(auth.uid());
 if reason='' then raise exception 'Use the verified customer deletion workflow.';end if;
 insert into public.account_closures(id,user_id,state,reason) values(gen_random_uuid(),auth.uid(),'assistance_requested',reason)
 on conflict(user_id) do update set state='assistance_requested',reason=excluded.reason,updated_at=now()
 returning id into result;return result;
end;
$$;
revoke all on function public.request_account_closure_help() from public,anon;
grant execute on function public.request_account_closure_help() to authenticated;

create function public.list_account_closure_requests() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.';end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from
 (select c.id,u.email,c.state,c.reason,c.created_at,c.updated_at from public.account_closures c left join auth.users u on u.id=c.user_id
 where c.state in ('assistance_requested','assistance_reviewed','failed') order by c.created_at desc limit 100) r),'[]'::jsonb);
end;
$$;
revoke all on function public.list_account_closure_requests() from public,anon;
grant execute on function public.list_account_closure_requests() to authenticated;

create function public.review_account_closure_request(request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.current_account_role() is distinct from 'owner' then raise exception 'Owner access is required.';end if;
 update public.account_closures set state='assistance_reviewed',updated_at=now() where id=request_id and state='assistance_requested';
 if not found then raise exception 'Request changed. Refresh requests.';end if;
end;
$$;
revoke all on function public.review_account_closure_request(uuid) from public,anon;
grant execute on function public.review_account_closure_request(uuid) to authenticated;

-- Freeze writes before enumerating media; in-flight storage inserts share this lock.
create function public.guard_closing_account_writes() returns trigger
language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 if tg_table_name='player_profiles' then u:=new.owner_id;else u:=new.user_id;end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,1011));
 if public.account_is_closing(u) then raise exception 'Account deletion is in progress.';end if;
 return new;
end;
$$;
revoke all on function public.guard_closing_account_writes() from public,anon,authenticated;
create trigger account_closure_profile_guard before insert or update on public.player_profiles for each row execute function public.guard_closing_account_writes();
create trigger account_closure_role_guard before insert or update on public.account_roles for each row execute function public.guard_closing_account_writes();

create function public.guard_closing_video_storage() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_account uuid;submitter uuid; u uuid;
begin
 if new.bucket_id<>'athlete-review-videos' then return new;end if;
 if split_part(new.name,'/',1) !~ '^[0-9a-f-]{36}$' then raise exception 'Invalid private media path.';end if;
 owner_account:=split_part(new.name,'/',1)::uuid;
 select submitted_by into submitter from public.athlete_video_reviews where asset_path=new.name;
 for u in select distinct v from unnest(array[owner_account,submitter]) v where v is not null order by v loop
  perform pg_advisory_xact_lock(hashtextextended(u::text,1011));
  if public.account_is_closing(u) then raise exception 'Account deletion is in progress.';end if;
 end loop;
 return new;
end;
$$;
revoke all on function public.guard_closing_video_storage() from public,anon,authenticated;
create trigger account_closure_storage_guard before insert or update on storage.objects for each row execute function public.guard_closing_video_storage();

-- Preserve the function OID so every existing RLS policy receives the guard.
create or replace function public.can_view_athlete(target_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not public.account_is_closing(auth.uid()) and exists(select 1 from public.player_profiles p where p.id=target_profile
 and not public.account_is_closing(p.owner_id) and (p.owner_id=auth.uid() or (
 public.child_access_ready(p.id) and exists(select 1 from public.family_athlete_links l where l.profile_id=p.id and l.athlete_user_id=auth.uid() and l.revoked_at is null))));
$$;

create or replace function public.can_view_athlete_video(review uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not public.account_is_closing(auth.uid()) and exists(select 1 from public.athlete_video_reviews v where v.id=review
 and not public.account_is_closing(v.account_id) and not public.account_is_closing(v.submitted_by)
 and (public.can_view_athlete(v.profile_id) or (v.status in ('queued','reviewed') and public.current_account_role() in ('owner','manager','coach') and exists(select 1 from public.member_training_access a where a.account_id=v.account_id and a.video_review_enabled and a.review_coach_id=auth.uid()))));
$$;

-- Never expose privileged RPCs to browser roles, including authenticated Owners.
revoke all on function public.begin_account_invitation(uuid,uuid,text,text),public.finish_account_invitation(uuid,uuid,text),
 public.begin_account_closure(uuid,uuid),public.account_closure_media(uuid),public.clear_account_closure_data(uuid,uuid),public.finish_account_closure(uuid,boolean) from public,anon,authenticated;
grant execute on function public.begin_account_invitation(uuid,uuid,text,text),public.finish_account_invitation(uuid,uuid,text),
 public.begin_account_closure(uuid,uuid),public.account_closure_media(uuid),public.clear_account_closure_data(uuid,uuid),public.finish_account_closure(uuid,boolean) to service_role;
notify pgrst,'reload schema';
commit;
