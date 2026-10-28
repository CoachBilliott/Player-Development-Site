-- DRAFT: additive learning system. Not applied to production.
-- Requires 001–012,015–018 only. No grouped review dependency or live cron.
begin;
create table public.learning_settings(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 scheduler_enabled boolean not null default false,
 notices_enabled boolean not null default false,
 youth_enabled boolean not null default false,
 friday_time time not null default '17:00',
 low_ready_weeks integer not null default 2 check(low_ready_weeks between 1 and 8)
);
insert into public.learning_settings default values;
create table public.learning_quizzes(
 id uuid primary key, title text not null check(length(title) between 1 and 160),
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);
create table public.learning_quiz_versions(
 id uuid primary key,quiz_id uuid not null references public.learning_quizzes(id),
 revision integer not null check(revision>0),questions jsonb not null,
 total_points integer not null check(total_points between 1 and 10000),
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 unique(quiz_id,revision)
);
create table public.learning_quiz_keys(
 version_id uuid primary key references public.learning_quiz_versions(id),keys jsonb not null
);
create table public.learning_plans(
 id uuid primary key,title text not null check(length(title) between 1 and 160),
 weeks integer not null check(weeks between 1 and 104),
 package_ids text[] not null default '{}',ages text[] not null default '{}',positions text[] not null default '{}',
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);
-- Every save appends a version. Approval is an explicit Owner/Manager action.
create table public.learning_week_versions(
 id uuid primary key,plan_id uuid not null references public.learning_plans(id),
 week_number integer not null check(week_number between 0 and 104),revision integer not null,
 title text not null check(length(title) between 1 and 160),
 resources jsonb not null default '[]',quiz_version_ids uuid[] not null default '{}',
 approved_at timestamptz,approved_by uuid references auth.users(id) on delete set null,retracted_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 unique(plan_id,week_number,revision)
);
create table public.learning_cohorts(
 id uuid primary key,title text not null check(length(title) between 1 and 100),created_by uuid references auth.users(id) on delete set null
);
create table public.learning_cohort_members(
 cohort_id uuid references public.learning_cohorts(id) on delete cascade,profile_id uuid references public.player_profiles(id) on delete cascade,
 primary key(cohort_id,profile_id)
);
-- Manually verified eligibility, NOT evidence of a Stripe/Apple purchase.
create table public.learning_access(
 profile_id uuid primary key references public.player_profiles(id) on delete cascade,package_id text not null,
 starts_at timestamptz not null,ends_at timestamptz not null,revoked_at timestamptz,
 reason text not null check(length(reason) between 1 and 500),verified_by uuid references auth.users(id) on delete set null,
 check(ends_at>starts_at)
);
create table public.learning_enrollments(
 id uuid primary key,profile_id uuid not null references public.player_profiles(id) on delete cascade,plan_id uuid not null references public.learning_plans(id),
 state text not null default 'active' check(state in ('active','paused','ended','finished')),
 next_week integer not null default 1 check(next_week between 1 and 105),next_release_at timestamptz not null,
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),version integer not null default 1,
 ended_at timestamptz
);
create unique index one_running_learning_plan on public.learning_enrollments(profile_id) where state in ('active','paused');
create table public.learning_week_overrides(
 enrollment_id uuid references public.learning_enrollments(id) on delete cascade,week_number integer not null,
 week_version_id uuid not null references public.learning_week_versions(id),primary key(enrollment_id,week_number)
);
create table public.learning_releases(
 id uuid primary key default gen_random_uuid(),enrollment_id uuid not null references public.learning_enrollments(id) on delete cascade,
 sequence integer not null,week_number integer not null,week_version_id uuid not null references public.learning_week_versions(id),
 available_at timestamptz not null default now(),scheduled_at timestamptz not null,
 repeated_from uuid references public.learning_releases(id) on delete set null,unique(enrollment_id,sequence)
);
create table public.learning_completion(
 release_id uuid references public.learning_releases(id) on delete cascade,item_id text not null,reported_by uuid references auth.users(id) on delete set null,
 completed_at timestamptz not null default now(),status text not null check(status in ('approved','pending_parent','needs_repeat','self_reported')),version integer not null default 1,reviewed_by uuid references auth.users(id) on delete set null,reviewed_at timestamptz,primary key(release_id,item_id)
);
create table public.learning_quiz_attempts(
 id uuid primary key,release_id uuid not null references public.learning_releases(id) on delete cascade,quiz_version_id uuid not null references public.learning_quiz_versions(id),
 actor_id uuid references auth.users(id) on delete set null,answers jsonb not null default '{}',
 state text not null default 'draft' check(state in ('draft','needs_grading','graded')),
 objective_points integer,submitted_at timestamptz,created_at timestamptz not null default now(),version integer not null default 1,
 unique(release_id,quiz_version_id,actor_id,id)
);
create table public.learning_quiz_grades(
 id uuid primary key default gen_random_uuid(),attempt_id uuid not null references public.learning_quiz_attempts(id) on delete cascade,
 revision integer not null,question_points jsonb not null,feedback text not null default '' check(length(feedback)<=4000),
 graded_by uuid references auth.users(id) on delete set null,graded_at timestamptz not null default now(),unique(attempt_id,revision)
);
create table public.learning_notices(
 id uuid primary key default gen_random_uuid(),event_key text not null unique,
 profile_id uuid not null references public.player_profiles(id) on delete cascade,release_id uuid references public.learning_releases(id) on delete cascade,
 category text not null check(category in ('content_ready','friday_incomplete','low_content','no_content')),
 staff_only boolean not null,created_at timestamptz not null default now(),resolved_at timestamptz
);
create table public.learning_notice_reads(
 notice_id uuid references public.learning_notices(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,read_at timestamptz not null default now(),
 primary key(notice_id,user_id)
);
create table public.learning_audit(
 id bigint generated always as identity primary key,actor_id uuid,action text not null,target uuid,detail jsonb not null default '{}',at timestamptz not null default now()
);
-- No public/raw authenticated table access, including answer keys and grades.
do $$declare t text;begin
 foreach t in array array['learning_settings','learning_quizzes','learning_quiz_versions','learning_quiz_keys','learning_plans','learning_week_versions','learning_cohorts','learning_cohort_members','learning_access','learning_enrollments','learning_week_overrides','learning_releases','learning_completion','learning_quiz_attempts','learning_quiz_grades','learning_notices','learning_notice_reads','learning_audit'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;end$$;
create function public.learning_require_staff() returns void language plpgsql stable security definer set search_path='' as $$begin
 if not exists(select 1 from public.learning_settings where enabled) then raise exception 'Learning plans are not enabled.';end if;
 if coalesce(public.current_account_role(),'') not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) then raise exception 'Staff access is required.';end if;
end$$;
create function public.learning_require_owner() returns void language plpgsql stable security definer set search_path='' as $$begin
 perform public.learning_require_staff();if public.current_account_role()<>'owner' then raise exception 'Owner access is required.';end if;
end$$;
create function public.learning_profile_allowed(target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_settings s join public.player_profiles p on p.id=target_profile where s.enabled
 and not public.account_is_closing(auth.uid()) and not public.account_is_closing(p.owner_id)
 and (s.youth_enabled or (p.age_group='18+' and not exists(select 1 from public.family_minor_profiles m where m.profile_id=p.id)))
 and (public.can_view_athlete(p.id) or public.staff_can_view_service_athlete(p.id)))
$$;
create function public.learning_can_submit(target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.learning_profile_allowed(target_profile) and public.can_view_athlete(target_profile) and exists(select 1 from public.player_profiles p where p.id=target_profile and (p.owner_id=auth.uid() or exists(select 1 from public.family_athlete_controls c where c.profile_id=p.id and c.self_recording_allowed)))
$$;
create function public.learning_eligible(target_profile uuid,target_plan uuid,at_time timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_access a join public.learning_plans p on p.id=target_plan join public.player_profiles f on f.id=a.profile_id
 where a.profile_id=target_profile and not public.account_is_closing(f.owner_id) and a.revoked_at is null and a.starts_at<=at_time and a.ends_at>at_time
 and (cardinality(p.package_ids)=0 or a.package_id=any(p.package_ids))
 and (cardinality(p.ages)=0 or f.age_group=any(p.ages)) and (cardinality(p.positions)=0 or f.position=any(p.positions)))
$$;
create function public.learning_next_sunday(at_time timestamptz) returns timestamptz language sql immutable set search_path='' as $$
 select ((date_trunc('week',at_time at time zone 'America/Chicago'+interval '1 day')+interval '6 days') at time zone 'America/Chicago')
$$;
-- Import API independently validates every question and answer key. No trusted client scoring.
create function public.learning_import_quiz(version_id uuid,target_quiz uuid,quiz_title text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare q jsonb;k jsonb;questions jsonb:=payload->'questions';key_items jsonb:=payload->'keys';total integer:=0;n integer:=0;rev integer;typ text;opts jsonb;v public.learning_quiz_versions;
begin
 perform public.learning_require_staff();
 if quiz_title is null or payload is null or length(trim(quiz_title)) not between 1 and 160 or jsonb_typeof(questions)<>'array' or jsonb_typeof(key_items)<>'array' then raise exception 'Invalid quiz import.';end if;
 if jsonb_array_length(questions) not between 1 and 100 or jsonb_array_length(key_items)<>jsonb_array_length(questions) then raise exception 'Include 1–100 matched questions and keys.';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_quiz::text,1919));
 if exists(select 1 from public.learning_quizzes where id=target_quiz and created_by<>auth.uid()) and public.current_account_role() not in ('owner','manager') then raise exception 'Quiz is outside your authoring scope.';end if;
 select * into v from public.learning_quiz_versions where id=version_id;
 if found then
  if v.quiz_id=target_quiz and v.questions=questions and exists(select 1 from public.learning_quizzes existing_quiz where existing_quiz.id=target_quiz and existing_quiz.title=trim(quiz_title)) and exists(select 1 from public.learning_quiz_keys existing_key where existing_key.version_id=v.id and existing_key.keys=key_items) then return v.id;end if;
  raise exception 'Import ID already exists with different data.';
 end if;
 for q in select value from jsonb_array_elements(questions) loop
  n:=n+1;typ:=q->>'type';opts:=q->'options';
  if (select count(*) from jsonb_object_keys(q))<>6 or not(q ?& array['id','order','type','question','options','points']) or coalesce(q->>'id','') !~ '^[A-Za-z0-9_-]{1,64}$' or (q->>'order')::integer<>n
   or length(trim(coalesce(q->>'question',''))) not between 1 and 2000 or (q->>'points')::numeric not between 1 and 100 or (q->>'points')::numeric<>trunc((q->>'points')::numeric)
   or jsonb_typeof(opts)<>'array' or typ not in ('multiple_choice','true_false','written') then raise exception 'Invalid question at row %.',n;end if;
  if (select count(*) from jsonb_array_elements(questions) x where x->>'id'=q->>'id')<>1 then raise exception 'Duplicate question ID.';end if;
  select value into k from jsonb_array_elements(key_items) where value->>'id'=q->>'id';
  if k is null or (select count(*) from jsonb_array_elements(key_items) x where x->>'id'=q->>'id')<>1 or (select count(*) from jsonb_object_keys(k))<>3 or not(k ?& array['id','correct','explanation']) or length(coalesce(k->>'explanation',''))>2000 then raise exception 'Invalid answer key.';end if;
  if typ='written' then
   if opts<>'[]'::jsonb or k->'correct'<>'null'::jsonb then raise exception 'Written answers require staff grading, not an answer key.';end if;
  else
   if jsonb_array_length(opts) not between 2 and 4 or exists(select 1 from jsonb_array_elements(opts) x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 400)
    or (select count(distinct x) from jsonb_array_elements(opts) x)<>jsonb_array_length(opts) or (k->>'correct')::numeric<>trunc((k->>'correct')::numeric) or (k->>'correct')::integer not between 0 and jsonb_array_length(opts)-1 then raise exception 'Invalid choices or answer key.';end if;
   if k->>'correct' is null or (typ='true_false' and opts<>'["True","False"]'::jsonb) then raise exception 'Invalid objective key.';end if;
  end if;
  total:=total+(q->>'points')::integer;
 end loop;
 insert into public.learning_quizzes(id,title,created_by) values(target_quiz,trim(quiz_title),auth.uid()) on conflict(id) do nothing;
 select coalesce(max(revision),0)+1 into rev from public.learning_quiz_versions where quiz_id=target_quiz;
 insert into public.learning_quiz_versions(id,quiz_id,revision,questions,total_points,created_by) values(version_id,target_quiz,rev,questions,total,auth.uid());
 insert into public.learning_quiz_keys values(version_id,key_items);
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'import_quiz',version_id);
 return version_id;
end$$;
create function public.learning_create_plan(target_id uuid,plan_title text,week_count integer,packages text[],age_groups text[],position_groups text[]) returns uuid
language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_staff();
 if exists(select 1 from public.learning_plans where id=target_id) then
  if exists(select 1 from public.learning_plans p where p.id=target_id and p.created_by=auth.uid() and p.title=trim(plan_title) and p.weeks=week_count and p.package_ids=packages and p.ages=age_groups and p.positions=position_groups) then return target_id;end if;
  raise exception 'Plan ID already exists with different data.';
 end if;
 insert into public.learning_plans(id,title,weeks,package_ids,ages,positions,created_by) values(target_id,trim(plan_title),week_count,packages,age_groups,position_groups,auth.uid());
 return target_id;
end$$;
create function public.learning_save_week(target_id uuid,target_plan uuid,week_no integer,week_title text,resource_ids uuid[],quizzes uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.learning_plans;snapshots jsonb;rev integer;
begin
 perform public.learning_require_staff();select * into strict p from public.learning_plans where id=target_plan;
 if p.created_by<>auth.uid() and public.current_account_role() not in ('owner','manager') then raise exception 'Plan is outside your authoring scope.';end if;
 if week_no<0 or week_no>p.weeks or cardinality(resource_ids)>24 or cardinality(quizzes)>8 or cardinality(resource_ids)+cardinality(quizzes)<1 or array_position(resource_ids,null) is not null or array_position(quizzes,null) is not null then raise exception 'Choose 1–24 lessons and at most 8 quizzes for this week.';end if;
 if (select count(distinct x) from unnest(resource_ids) x)<>cardinality(resource_ids) or (select count(distinct x) from unnest(quizzes) x)<>cardinality(quizzes) then raise exception 'Remove duplicate items.';end if;
 if exists(select 1 from unnest(resource_ids) rid left join public.training_resources r on r.id=rid where r.id is null or (r.created_by<>auth.uid() and public.current_account_role() not in ('owner','manager'))) then raise exception 'Choose resources in your authoring scope.';end if;
 if exists(select 1 from unnest(quizzes) qid left join public.learning_quiz_versions v on v.id=qid where v.id is null or (v.created_by<>auth.uid() and public.current_account_role() not in ('owner','manager'))) then raise exception 'Choose quiz versions in your authoring scope.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'content',r.content,'asset_path',r.asset_path,'asset_type',r.asset_type,'asset_name',r.asset_name) order by ord),'[]') into snapshots from unnest(resource_ids) with ordinality i(id,ord) join public.training_resources r on r.id=i.id;
 perform pg_advisory_xact_lock(hashtextextended(target_plan::text,1920));
 if exists(select 1 from public.learning_week_versions where id=target_id) then
  if exists(select 1 from public.learning_week_versions w where w.id=target_id and w.created_by=auth.uid() and w.plan_id=target_plan and w.week_number=week_no and w.title=trim(week_title) and w.resources=snapshots and w.quiz_version_ids=quizzes) then return target_id;end if;
  raise exception 'Week ID already exists with different data.';
 end if;
 select coalesce(max(revision),0)+1 into rev from public.learning_week_versions where plan_id=target_plan and week_number=week_no;
 insert into public.learning_week_versions(id,plan_id,week_number,revision,title,resources,quiz_version_ids,created_by) values(target_id,target_plan,week_no,rev,trim(week_title),snapshots,quizzes,auth.uid());
 return target_id;
end$$;
create function public.learning_week_ready(target_week uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_week_versions w where w.id=target_week and w.approved_at is not null and w.retracted_at is null
 and not exists(select 1 from jsonb_array_elements(w.resources) s where not exists(
 select 1 from public.training_resources r join storage.objects o on o.bucket_id='training-media' and o.name=r.asset_path
 where r.id=(s->>'id')::uuid and r.version=(s->>'version')::integer and r.status='published' and r.review_stage='approved'
 and r.asset_path=s->>'asset_path' and coalesce((o.metadata->>'size')::bigint,0)>0 and o.metadata->>'mimetype'=r.asset_type)))
$$;
create function public.learning_approve_week(target_week uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_staff();if public.current_account_role() not in ('owner','manager') then raise exception 'Owner or Manager approval is required.';end if;
 update public.learning_week_versions set approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()) where id=target_week;
 if not found then raise exception 'Week not found.';end if;
 if not public.learning_week_ready(target_week) then raise exception 'All lesson uploads must be complete, approved and unchanged.';end if;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'approve_week',target_week);
end$$;
create function public.learning_selected_week(target_enrollment uuid,week_no integer) returns uuid language sql stable security definer set search_path='' as $$
 select coalesce((select week_version_id from public.learning_week_overrides where enrollment_id=target_enrollment and week_number=week_no),
 (select w.id from public.learning_week_versions w join public.learning_enrollments e on e.plan_id=w.plan_id where e.id=target_enrollment and w.week_number=week_no and w.approved_at is not null order by w.revision desc limit 1))
$$;
create function public.learning_week_matches_profile(target_week uuid,target_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_week_versions w join public.player_profiles p on p.id=target_profile where w.id=target_week
 and not exists(select 1 from jsonb_array_elements(w.resources) x where not coalesce((x->'content'->'ages') ? p.age_group,false)
 or (jsonb_array_length(x->'content'->'positions')>0 and not coalesce((x->'content'->'positions') ? p.position,false))
 or not coalesce((x->'content'->'levels') ? p.experience,false)))
$$;
create function public.learning_enroll(target_id uuid,target_profile uuid,target_plan uuid,orientation_now boolean default true) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.learning_enrollments;w uuid;
begin
 perform public.learning_require_owner();
 if not public.learning_profile_allowed(target_profile) or not public.learning_eligible(target_profile,target_plan,now()) then raise exception 'Athlete is outside scope or does not have verified active plan eligibility.';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_profile::text,1921));
 select * into e from public.learning_enrollments where id=target_id;
 if found then if e.profile_id=target_profile and e.plan_id=target_plan then return e.id;end if;raise exception 'Enrollment ID already used.';end if;
 if exists(select 1 from public.learning_enrollments where profile_id=target_profile and state in ('active','paused')) then raise exception 'End the current enrollment before starting another; history is retained.';end if;
 insert into public.learning_enrollments(id,profile_id,plan_id,next_release_at,created_by) values(target_id,target_profile,target_plan,public.learning_next_sunday(now()),auth.uid());
 if orientation_now then
  w:=public.learning_selected_week(target_id,0);
  if public.learning_week_ready(w) and public.learning_week_matches_profile(w,target_profile) then insert into public.learning_releases(enrollment_id,sequence,week_number,week_version_id,scheduled_at) values(target_id,0,0,w,now());end if;
 end if;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'enroll',target_id);return target_id;
end$$;
create function public.learning_set_access(target_profile uuid,package_name text,starts timestamptz,ends timestamptz,reason_text text,revoke boolean default false) returns void
language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_owner();if not public.learning_profile_allowed(target_profile) then raise exception 'Athlete is outside scope.';end if;
 if package_name not in ('foundation','fundamentals','position-development','elite-coaching','private_test') then raise exception 'Choose a configured package ID.';end if;
 insert into public.learning_access(profile_id,package_id,starts_at,ends_at,reason,verified_by,revoked_at) values(target_profile,package_name,starts,ends,reason_text,auth.uid(),case when revoke then now() end)
 on conflict(profile_id) do update set package_id=excluded.package_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,reason=excluded.reason,verified_by=auth.uid(),revoked_at=excluded.revoked_at;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'verify_access',target_profile);
end$$;
create function public.learning_control(target_enrollment uuid,action_name text,expected_version integer,target_release uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare e public.learning_enrollments;r public.learning_releases;n integer;
begin
 perform public.learning_require_owner();select * into strict e from public.learning_enrollments where id=target_enrollment for update;
 if not public.learning_profile_allowed(e.profile_id) then raise exception 'Athlete is outside scope.';end if;
 if e.version<>expected_version then raise exception 'Enrollment changed. Refresh before saving.';end if;
 if action_name='pause' and e.state='active' then update public.learning_enrollments set state='paused',version=version+1 where id=e.id;
 elsif action_name='resume' and e.state='paused' then update public.learning_enrollments set state='active',next_release_at=public.learning_next_sunday(now()),version=version+1 where id=e.id;
 elsif action_name='end' and e.state in ('active','paused','finished') then update public.learning_enrollments set state='ended',ended_at=now(),version=version+1 where id=e.id;
 elsif action_name='repeat' and e.state in ('active','finished') then
  select * into strict r from public.learning_releases where id=target_release and enrollment_id=e.id;
  if not public.learning_eligible(e.profile_id,e.plan_id,now()) then raise exception 'Active eligibility is required.';end if;
  select coalesce(max(sequence),0)+1 into n from public.learning_releases where enrollment_id=e.id;
  insert into public.learning_releases(enrollment_id,sequence,week_number,week_version_id,scheduled_at,repeated_from) values(e.id,n,r.week_number,r.week_version_id,now(),r.id);
  update public.learning_enrollments set next_release_at=public.learning_next_sunday(now()),version=version+1 where id=e.id;
 else raise exception 'This enrollment cannot perform that action.';end if;
 if action_name in ('pause','end') then update public.learning_notices set resolved_at=now() where profile_id=e.profile_id and resolved_at is null;end if;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),action_name,e.id);return e.version+1;
end$$;
create function public.learning_set_override(target_enrollment uuid,week_no integer,target_week uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.learning_enrollments;begin
 perform public.learning_require_owner();select * into strict e from public.learning_enrollments where id=target_enrollment for update;
 if not public.learning_profile_allowed(e.profile_id) or week_no<e.next_week or not exists(select 1 from public.learning_week_versions where id=target_week and plan_id=e.plan_id and week_number=week_no and approved_at is not null) or not public.learning_week_ready(target_week) or not public.learning_week_matches_profile(target_week,e.profile_id) then raise exception 'Choose an approved future week in this plan.';end if;
 insert into public.learning_week_overrides values(e.id,week_no,target_week) on conflict(enrollment_id,week_number) do update set week_version_id=excluded.week_version_id;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'override_week',e.id);
end$$;
create function public.learning_save_cohort(target_id uuid,cohort_title text,profiles uuid[]) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_owner();if cardinality(profiles)>500 or exists(select 1 from unnest(profiles) p where not public.learning_profile_allowed(p)) then raise exception 'Choose at most 500 in-scope athletes.';end if;
 insert into public.learning_cohorts values(target_id,trim(cohort_title),auth.uid()) on conflict(id) do update set title=excluded.title;
 delete from public.learning_cohort_members where cohort_id=target_id;
 insert into public.learning_cohort_members select target_id,p from (select distinct unnest(profiles) p) s;
end$$;
create function public.learning_enroll_cohort(target_cohort uuid,target_plan uuid,operation_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare p uuid;n integer:=0;existing integer;begin
 perform public.learning_require_owner();perform pg_advisory_xact_lock(hashtextextended(operation_id::text,1922));
 select count(*) into existing from public.learning_audit where action='enroll_cohort' and target=operation_id;
 if existing>0 then
  if not exists(select 1 from public.learning_audit where action='enroll_cohort' and target=operation_id and detail->>'cohort'=target_cohort::text and detail->>'plan'=target_plan::text) then raise exception 'Group operation ID already used.';end if;
  return (select (detail->>'count')::integer from public.learning_audit where action='enroll_cohort' and target=operation_id limit 1);end if;
 for p in select profile_id from public.learning_cohort_members where cohort_id=target_cohort order by profile_id loop
  perform public.learning_enroll(gen_random_uuid(),p,target_plan,true);n:=n+1;
 end loop;
 if n=0 then raise exception 'Group has no athletes.';end if;
 insert into public.learning_audit(actor_id,action,target,detail) values(auth.uid(),'enroll_cohort',operation_id,jsonb_build_object('count',n,'cohort',target_cohort,'plan',target_plan));return n;
end$$;
create function public.learning_group_results(target_cohort uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform public.learning_require_staff();
 return coalesce((select jsonb_agg(jsonb_build_object('profile_id',p.id,'name',p.nickname,'releases',
 (select count(*) from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where e.profile_id=p.id),
 'completed_weeks',(select count(*) from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where e.profile_id=p.id and public.learning_release_done(r.id)),
 'quiz_attempts',coalesce((select jsonb_agg(jsonb_build_object('quiz',q.title,'week_number',r.week_number,'state',a.state,'submitted_at',a.submitted_at,'objective_points',a.objective_points,'total_points',v.total_points,'written_points',(select coalesce(sum((value#>>'{}')::numeric),0) from jsonb_each((select g.question_points from public.learning_quiz_grades g where g.attempt_id=a.id order by g.revision desc limit 1))))) from public.learning_enrollments e join public.learning_releases r on r.enrollment_id=e.id join public.learning_quiz_attempts a on a.release_id=r.id join public.learning_quiz_versions v on v.id=a.quiz_version_id join public.learning_quizzes q on q.id=v.quiz_id where e.profile_id=p.id),'[]')) order by p.nickname)
 from public.learning_cohort_members m join public.player_profiles p on p.id=m.profile_id where m.cohort_id=target_cohort and public.learning_profile_allowed(p.id) and public.staff_can_view_service_athlete(p.id)),'[]');
end$$;
create function public.learning_configure_rules(friday_clock time,ready_threshold integer) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_owner();
 update public.learning_settings set friday_time=friday_clock,low_ready_weeks=ready_threshold;
 insert into public.learning_audit(actor_id,action,detail) values(auth.uid(),'configure_learning_rules',jsonb_build_object('friday_time',friday_clock,'low_ready_weeks',ready_threshold));
end$$;
-- Shared authorization for release, quiz and completion endpoints. No guardian bypass.
create function public.learning_release_allowed(target_release uuid,require_access boolean default true) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=target_release and r.available_at<=now()
 and exists(select 1 from public.learning_week_versions w where w.id=r.week_version_id and w.retracted_at is null) and public.learning_profile_allowed(e.profile_id) and (not require_access or public.learning_eligible(e.profile_id,e.plan_id,now())))
$$;
create function public.learning_save_attempt(target_attempt uuid,target_release uuid,target_quiz uuid,responses jsonb,submit boolean,expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.learning_quiz_attempts;q jsonb;k jsonb;v public.learning_quiz_versions;answer jsonb;points integer:=0;manual boolean:=false;new_state text;w public.learning_week_versions;profile uuid;
begin
 if not public.learning_release_allowed(target_release) then raise exception 'This quiz is unavailable.';end if;
 select e.profile_id into profile from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=target_release;
 if not public.learning_can_submit(profile) then raise exception 'The parent has paused independent recording, or this athlete is outside your household.';end if;
 select wv.* into strict w from public.learning_releases r join public.learning_week_versions wv on wv.id=r.week_version_id where r.id=target_release;
 if not target_quiz=any(w.quiz_version_ids) then raise exception 'Quiz is not assigned in this release.';end if;
 if jsonb_typeof(responses)<>'object' or octet_length(responses::text)>220000 then raise exception 'Invalid answer data.';end if;
 select * into strict v from public.learning_quiz_versions where id=target_quiz;
 if exists(select 1 from jsonb_object_keys(responses) x where not exists(select 1 from jsonb_array_elements(v.questions) candidate where candidate->>'id'=x)) then raise exception 'Unknown question.';end if;
 for q in select value from jsonb_array_elements(v.questions) loop
  answer:=responses->(q->>'id');
  if answer is not null and answer<>'null'::jsonb then
   if q->>'type'='written' then if jsonb_typeof(answer)<>'string' or length(answer#>>'{}')>2000 then raise exception 'Written answers must be at most 2000 characters.';end if;
   elsif jsonb_typeof(answer)<>'number' or (answer#>>'{}')::numeric<>trunc((answer#>>'{}')::numeric) or (answer#>>'{}')::integer not between 0 and jsonb_array_length(q->'options')-1 then raise exception 'Choose a valid answer.';end if;
  end if;
  if submit and (answer is null or answer='null'::jsonb or (q->>'type'='written' and length(trim(answer#>>'{}'))=0)) then raise exception 'Answer every question before submitting.';end if;
  if q->>'type'='written' then manual:=true;
  elsif submit then select value into strict k from public.learning_quiz_keys t cross join jsonb_array_elements(t.keys) where t.version_id=v.id and value->>'id'=q->>'id';
   if answer=k->'correct' then points:=points+(q->>'points')::integer;end if;
  end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(target_attempt::text,1923));
 select * into a from public.learning_quiz_attempts where id=target_attempt for update;
 if found then
  if a.actor_id<>auth.uid() or a.release_id<>target_release or a.quiz_version_id<>target_quiz then raise exception 'Attempt is outside your scope.';end if;
  if a.state<>'draft' then if submit and a.answers=responses then return jsonb_build_object('id',a.id,'state',a.state,'version',a.version,'objective_points',a.objective_points);end if;raise exception 'Submitted answers cannot be edited. Start a new attempt.';end if;
  if not submit and a.answers=responses then return jsonb_build_object('id',a.id,'state',a.state,'version',a.version,'objective_points',a.objective_points);end if;
  if a.version<>expected_version then raise exception 'Answers changed on another device. Reload before saving.';end if;
 else
  if expected_version<>0 then raise exception 'Attempt not found. Reload before saving.';end if;
  if (select count(*) from public.learning_quiz_attempts where release_id=target_release and quiz_version_id=target_quiz and actor_id=auth.uid())>=10 then raise exception 'Ten attempts are retained. Ask staff before another retry.';end if;
 end if;
 new_state:=case when not submit then 'draft' when manual then 'needs_grading' else 'graded' end;
 insert into public.learning_quiz_attempts(id,release_id,quiz_version_id,actor_id,answers,state,objective_points,submitted_at) values(target_attempt,target_release,target_quiz,auth.uid(),responses,new_state,case when submit then points end,case when submit then now() end)
 on conflict(id) do update set answers=excluded.answers,state=excluded.state,objective_points=excluded.objective_points,submitted_at=excluded.submitted_at,version=learning_quiz_attempts.version+1 returning * into a;
 return jsonb_build_object('id',a.id,'state',a.state,'version',a.version,'objective_points',a.objective_points);
end$$;
create function public.learning_grade_written(target_attempt uuid,marks jsonb,feedback_text text,expected_revision integer) returns integer language plpgsql security definer set search_path='' as $$
declare a public.learning_quiz_attempts;v public.learning_quiz_versions;q jsonb;n integer;profile uuid;begin
 perform public.learning_require_staff();select * into strict a from public.learning_quiz_attempts where id=target_attempt for update;
 select e.profile_id into profile from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=a.release_id;
 if not public.learning_profile_allowed(profile) or not public.staff_can_view_service_athlete(profile) or a.state='draft' then raise exception 'Attempt is outside your grading scope.';end if;
 select * into strict v from public.learning_quiz_versions where id=a.quiz_version_id;
 select coalesce(max(revision),0) into n from public.learning_quiz_grades where attempt_id=a.id;
 if n<>expected_revision then raise exception 'Grade changed. Refresh before saving.';end if;
 if jsonb_typeof(marks)<>'object' or exists(select 1 from jsonb_object_keys(marks) x where not exists(select 1 from jsonb_array_elements(v.questions) candidate where candidate->>'id'=x and candidate->>'type'='written')) then raise exception 'Grade written questions only.';end if;
 for q in select value from jsonb_array_elements(v.questions) where value->>'type'='written' loop
  if marks->(q->>'id') is null or jsonb_typeof(marks->(q->>'id'))<>'number' or (marks->>(q->>'id'))::numeric<0 or (marks->>(q->>'id'))::numeric>(q->>'points')::numeric then raise exception 'Grade every written question within its points.';end if;
 end loop;
 insert into public.learning_quiz_grades(attempt_id,revision,question_points,feedback,graded_by) values(a.id,n+1,marks,feedback_text,auth.uid());
 update public.learning_quiz_attempts set state='graded' where id=a.id;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'grade_written',a.id);return n+1;
end$$;
create function public.learning_complete(target_release uuid,item text) returns void language plpgsql security definer set search_path='' as $$
declare profile uuid;begin
 if not public.learning_release_allowed(target_release) then raise exception 'This release is unavailable.';end if;
 select e.profile_id into profile from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=target_release;
 if not public.learning_can_submit(profile) then raise exception 'The parent has paused independent recording, or this athlete is outside your household.';end if;
 if not exists(select 1 from public.learning_releases r join public.learning_week_versions w on w.id=r.week_version_id cross join jsonb_array_elements(w.resources) x where r.id=target_release and x->>'id'=item) then raise exception 'Lesson is not assigned in this release.';end if;
 insert into public.learning_completion(release_id,item_id,reported_by,status,reviewed_by,reviewed_at) select target_release,item,auth.uid(),case when a.account_type='parent' and p.owner_id=auth.uid() then 'approved' when a.account_type='parent' then 'pending_parent' else 'self_reported' end,case when p.owner_id=auth.uid() and a.account_type='parent' then auth.uid() end,case when p.owner_id=auth.uid() and a.account_type='parent' then now() end from public.player_profiles p join public.member_accounts a on a.user_id=p.owner_id where p.id=profile
 on conflict(release_id,item_id) do update set status=excluded.status,reported_by=excluded.reported_by,completed_at=now(),version=learning_completion.version+1 where learning_completion.status='needs_repeat';
end$$;
create function public.learning_review_completion(target_release uuid,item text,decision text,expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare c public.learning_completion;begin
 if decision is null or decision not in ('approved','needs_repeat') then raise exception 'Choose a parent review decision.';end if;
 if not public.learning_release_allowed(target_release,false) or not exists(select 1 from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id join public.player_profiles p on p.id=e.profile_id join public.member_accounts a on a.user_id=p.owner_id where r.id=target_release and p.owner_id=auth.uid() and a.account_type='parent') then raise exception 'Only this athlete’s parent can review practice.';end if;
 select * into strict c from public.learning_completion where release_id=target_release and item_id=item for update;
 if c.version<>expected_version or c.status<>'pending_parent' then raise exception 'Practice review changed. Reload before reviewing.';end if;
 update public.learning_completion set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),version=version+1 where release_id=target_release and item_id=item;
 insert into public.learning_audit(actor_id,action,target,detail) values(auth.uid(),'parent_practice_review',target_release,jsonb_build_object('item',item,'decision',decision,'version',expected_version+1));
end$$;
create function public.learning_release_done(target_release uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_releases r join public.learning_week_versions w on w.id=r.week_version_id where r.id=target_release
 and not exists(select 1 from jsonb_array_elements(w.resources) x where not exists(select 1 from public.learning_completion c where c.release_id=r.id and c.item_id=x->>'id' and c.status<>'needs_repeat'))
 and not exists(select 1 from unnest(w.quiz_version_ids) q where not exists(select 1 from public.learning_quiz_attempts a where a.release_id=r.id and a.quiz_version_id=q and a.submitted_at is not null)))
$$;
-- Scheduler entry is service-role only, disabled by default, dry-run supported.
-- Late invocation releases ONE week; it never dumps a backlog on an athlete.
create function public.learning_tick(at_time timestamptz default now(),dry_run boolean default true) returns jsonb
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
  update public.learning_notices n set resolved_at=at_time where n.category='friday_incomplete' and n.resolved_at is null and public.learning_release_done(n.release_id);
 end if;
 return jsonb_build_object('dry_run',dry_run,'releases',count_release,'reminders',count_reminder,'low_content',count_low,'failed_enrollments',failed,'timezone','America/Chicago');
end$$;
create function public.learning_athlete(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not public.learning_profile_allowed(target_profile) then raise exception 'Athlete is outside your learning scope.';end if;
 select jsonb_build_object('can_submit',public.learning_can_submit(target_profile),'is_guardian',exists(select 1 from public.player_profiles p join public.member_accounts a on a.user_id=p.owner_id where p.id=target_profile and p.owner_id=auth.uid() and a.account_type='parent'),'enrollments',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'plan_id',e.plan_id,'title',p.title,'state',e.state,'next_week',e.next_week,'next_release_at',e.next_release_at,'version',e.version,'access_active',public.learning_eligible(e.profile_id,e.plan_id,now()),'releases',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'sequence',r.sequence,'week_number',r.week_number,'title',w.title,'available_at',r.available_at,'scheduled_at',r.scheduled_at,'content_blocked',w.retracted_at is not null,'done',public.learning_release_done(r.id),
 'resources',case when public.learning_eligible(e.profile_id,e.plan_id,now()) and w.retracted_at is null then w.resources else '[]'::jsonb end,
 'quizzes',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'title',s.title,'total_points',q.total_points,'questions',case when (public.learning_eligible(e.profile_id,e.plan_id,now()) or public.staff_can_view_service_athlete(e.profile_id)) and w.retracted_at is null then q.questions else '[]'::jsonb end)) from unnest(w.quiz_version_ids) x join public.learning_quiz_versions q on q.id=x join public.learning_quizzes s on s.id=q.quiz_id),'[]'),
 'completion_reviews',coalesce((select jsonb_agg(jsonb_build_object('item_id',c.item_id,'status',c.status,'version',c.version,'completed_at',c.completed_at,'reviewed_at',c.reviewed_at)) from public.learning_completion c where c.release_id=r.id),'[]'),'completed_items',coalesce((select jsonb_agg(item_id) from public.learning_completion c where c.release_id=r.id and c.status<>'needs_repeat'),'[]'),
 'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'quiz_version_id',a.quiz_version_id,'actor_id',a.actor_id,'answers',a.answers,'state',a.state,'objective_points',a.objective_points,'submitted_at',a.submitted_at,'version',a.version,'grades',coalesce((select jsonb_agg(jsonb_build_object('revision',g.revision,'points',g.question_points,'feedback',g.feedback,'graded_at',g.graded_at) order by revision) from public.learning_quiz_grades g where g.attempt_id=a.id),'[]'))) from public.learning_quiz_attempts a where a.release_id=r.id),'[]')) order by r.sequence desc) from public.learning_releases r join public.learning_week_versions w on w.id=r.week_version_id where r.enrollment_id=e.id),'[]')) order by e.created_at desc) from public.learning_enrollments e join public.learning_plans p on p.id=e.plan_id where e.profile_id=target_profile),'[]')) into result;
 return result;
end$$;
create function public.learning_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform public.learning_require_staff();return jsonb_build_object('plans',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('weeks_content',coalesce((select jsonb_agg(to_jsonb(w)||jsonb_build_object('ready',public.learning_week_ready(w.id)) order by week_number,revision desc) from public.learning_week_versions w where w.plan_id=p.id),'[]'))) from public.learning_plans p where p.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'quizzes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'quiz_id',v.quiz_id,'title',q.title,'revision',v.revision,'questions',v.questions,'keys',k.keys,'total_points',v.total_points)) from public.learning_quiz_versions v join public.learning_quizzes q on q.id=v.quiz_id join public.learning_quiz_keys k on k.version_id=v.id where v.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'rules',(select jsonb_build_object('friday_time',friday_time::text,'low_ready_weeks',low_ready_weeks) from public.learning_settings),'cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'profiles',coalesce((select jsonb_agg(m.profile_id) from public.learning_cohort_members m where m.cohort_id=c.id and public.learning_profile_allowed(m.profile_id)),'[]'))) from public.learning_cohorts c where public.current_account_role() in ('owner','manager') or exists(select 1 from public.learning_cohort_members m where m.cohort_id=c.id and public.staff_can_view_service_athlete(m.profile_id))),'[]'));
end$$;
create function public.learning_inbox() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'profile_id',n.profile_id,'release_id',n.release_id,'category',n.category,'created_at',n.created_at,'read',exists(select 1 from public.learning_notice_reads r where r.notice_id=n.id and r.user_id=auth.uid())) order by n.created_at desc),'[]')
 from public.learning_notices n where n.resolved_at is null and public.learning_profile_allowed(n.profile_id) and ((n.staff_only and public.staff_can_view_service_athlete(n.profile_id)) or (not n.staff_only and public.can_view_athlete(n.profile_id)))
$$;
create function public.learning_read_notice(target_notice uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from jsonb_array_elements(public.learning_inbox()) x where x->>'id'=target_notice::text) then raise exception 'Notice is outside your scope.';end if;
 insert into public.learning_notice_reads values(target_notice,auth.uid(),now()) on conflict do nothing;
end$$;
create function public.learning_retract_week(target_week uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_staff();if public.current_account_role() not in ('owner','manager') then raise exception 'Owner or Manager access is required.';end if;
 update public.learning_week_versions set retracted_at=coalesce(retracted_at,now()) where id=target_week;
 if not found then raise exception 'Week not found.';end if;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'retract_week',target_week);
end$$;
alter function public.account_closure_reason(uuid) rename to account_closure_reason_before_learning;
revoke all on function public.account_closure_reason_before_learning(uuid) from public,anon,authenticated;
create function public.account_closure_reason(target uuid) returns text language sql stable security definer set search_path='' as $$
 select case when public.account_closure_reason_before_learning(target)<>'' then public.account_closure_reason_before_learning(target)
 when exists(select 1 from public.learning_quizzes where created_by=target) or exists(select 1 from public.learning_plans where created_by=target) then 'staff_content' else '' end
$$;
revoke all on function public.account_closure_reason(uuid) from public,anon,authenticated;
-- Explicit RPC grants: internal helpers and tick are never public-callable.
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'learning_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;end$$;
grant execute on function public.learning_import_quiz(uuid,uuid,text,jsonb),public.learning_create_plan(uuid,text,integer,text[],text[],text[]),public.learning_save_week(uuid,uuid,integer,text,uuid[],uuid[]),public.learning_approve_week(uuid),public.learning_enroll(uuid,uuid,uuid,boolean),public.learning_set_access(uuid,text,timestamptz,timestamptz,text,boolean),public.learning_control(uuid,text,integer,uuid),public.learning_set_override(uuid,integer,uuid),public.learning_save_cohort(uuid,text,uuid[]),public.learning_enroll_cohort(uuid,uuid,uuid),public.learning_save_attempt(uuid,uuid,uuid,jsonb,boolean,integer),public.learning_grade_written(uuid,jsonb,text,integer),public.learning_complete(uuid,text),public.learning_review_completion(uuid,text,text,integer),public.learning_athlete(uuid),public.learning_catalog(),public.learning_inbox(),public.learning_read_notice(uuid),public.learning_retract_week(uuid),public.learning_configure_rules(time,integer),public.learning_group_results(uuid) to authenticated;
grant execute on function public.learning_tick(timestamptz,boolean) to service_role;
commit;
