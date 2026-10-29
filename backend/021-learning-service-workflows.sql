-- DRAFT, not installed. Requires 019/020. No flags, cron or roles are activated.
begin;
create index learning_enrollment_profile_history on public.learning_enrollments(profile_id,created_at desc,id);
create index learning_attempt_review_state on public.learning_quiz_attempts(state,release_id);
create index learning_notice_profile_state on public.learning_notices(profile_id,resolved_at,category);
create index learning_cohort_profile on public.learning_cohort_members(profile_id,cohort_id);
create function public.learning_search(value text) returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(normalize(coalesce(value,''),NFKD),U&'[\0300-\036f]','','g'))
$$;
create function public.learning_staff_summary(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.learning_enrollments;p public.learning_plans;r public.learning_releases;w public.learning_week_versions;ready integer:=0;pending_grades integer;pending_parent integer;summary_state text;active_access boolean;last_report timestamptz;
begin
 perform public.learning_require_staff();if not public.staff_can_view_service_athlete(target_profile) then raise exception 'Athlete is outside your service roster.';end if;
 select * into e from public.learning_enrollments where profile_id=target_profile and state in ('active','paused','finished') order by created_at desc,id desc limit 1;
 select count(*)::integer into pending_grades from public.learning_quiz_attempts a join public.learning_releases lr on lr.id=a.release_id join public.learning_enrollments le on le.id=lr.enrollment_id where le.profile_id=target_profile and a.state='needs_grading';
 select count(*)::integer into pending_parent from public.learning_completion c join public.learning_releases lr on lr.id=c.release_id join public.learning_enrollments le on le.id=lr.enrollment_id where le.profile_id=target_profile and c.status='pending_parent';
 if e.id is null then return jsonb_build_object('enabled',true,'status',case when pending_grades>0 then 'needs_grading' when pending_parent>0 then 'pending_parent' else 'not_enrolled' end,'title',null,'enrollment_id',null,'ready_weeks',0,'pending_grades',pending_grades,'pending_parent',pending_parent);end if;
 select * into strict p from public.learning_plans where id=e.plan_id;
 select * into r from public.learning_releases where enrollment_id=e.id order by sequence desc limit 1;
 select * into w from public.learning_week_versions where id=r.week_version_id;
 active_access:=public.learning_eligible(target_profile,e.plan_id,now());
 while e.next_week+ready<=p.weeks and public.learning_week_ready(public.learning_selected_week(e.id,e.next_week+ready)) and public.learning_week_matches_profile(public.learning_selected_week(e.id,e.next_week+ready),target_profile) loop ready:=ready+1;end loop;
 select max(at_time) into last_report from (select a.submitted_at at_time from public.learning_quiz_attempts a join public.learning_releases lr on lr.id=a.release_id where lr.enrollment_id=e.id union all select c.completed_at from public.learning_completion c join public.learning_releases lr on lr.id=c.release_id where lr.enrollment_id=e.id) reports;
 summary_state:=case when not active_access then 'access_inactive' when e.state='paused' then 'paused' when pending_grades>0 then 'needs_grading' when pending_parent>0 then 'pending_parent' when w.retracted_at is not null then 'content_withdrawn' when e.state='active' and e.next_week<=p.weeks and ready=0 then 'needs_content' when r.id is null then 'awaiting_release' when public.learning_release_done(r.id) then case when e.state='finished' then 'plan_complete' else 'week_complete' end else 'ready' end;
 return jsonb_build_object('enabled',true,'enrollment_id',e.id,'plan_id',p.id,'title',p.title,'status',summary_state,'enrollment_state',e.state,'access_active',active_access,'current_week',r.week_number,'current_title',w.title,'current_release_id',r.id,'available_at',r.available_at,'scheduled_at',r.scheduled_at,'next_week',e.next_week,'next_release_at',case when e.state='active' then e.next_release_at end,'ready_weeks',ready,'total_weeks',p.weeks,'pending_grades',pending_grades,'pending_parent',pending_parent,'last_reported_at',last_report);
end$$;
-- Preserve the legacy source for advanced single-workout controls; new weekly
-- summary does not pretend a plan enrollment is a saved workout assignment.
alter function public.staff_athlete_service(uuid) rename to staff_athlete_service_before_learning;
revoke all on function public.staff_athlete_service_before_learning(uuid) from public,anon,authenticated;
create function public.staff_athlete_service(target_profile uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;summary jsonb;next_step text;begin
 result:=public.staff_athlete_service_before_learning(target_profile);
 if not exists(select 1 from public.learning_settings where enabled) then return result;end if;
 summary:=public.learning_staff_summary(target_profile);
 next_step:=case when (result->>'overdue_reviews')::integer>0 then 'Follow up overdue review' when (result->>'blocked_reviews')::integer>0 then 'Resolve review follow-up' when result->>'coach_id' is null then 'Assign service coach'
 when summary->>'status'='not_enrolled' then 'Start a weekly plan' when summary->>'status'='access_inactive' then 'Review package eligibility' when summary->>'status'='paused' then 'Review paused plan' when summary->>'status'='needs_grading' then 'Grade written quiz answers' when summary->>'status'='pending_parent' then 'View parent practice review' when summary->>'status'='content_withdrawn' then 'Resolve withdrawn content' when summary->>'status'='needs_content' then 'Prepare the next week' when summary->>'status'='awaiting_release' then 'Review scheduled first week' when summary->>'status'='plan_complete' then 'Review completed plan' else 'View weekly training' end;
 return result||jsonb_build_object('learning',summary,'next_action',next_step);
end$$;
-- Keyset pagination: queries apply scope/search/status before bounded details.
-- Contact email is returned only in the same Owner/Manager scope as migration015.
create function public.staff_learning_roster_page(search_text text default '',status_filter text default 'all',age_filter text default '',position_filter text default '',coach_filter text default '',after_cursor jsonb default null,page_size integer default 25) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor_role text;result jsonb;begin
 perform public.learning_require_staff();actor_role:=public.current_account_role();
 if search_text is null or length(search_text)>160 or status_filter is null or status_filter not in ('all','overdue','blocked','ready','unassigned') or page_size is null or page_size not between 1 and 100 then raise exception 'Choose valid roster filters and a page size from 1 to 100.';end if;
 if after_cursor is not null and (jsonb_typeof(after_cursor)<>'object' or not(after_cursor ?& array['priority','label','key']) or (after_cursor->>'priority')::integer not between 0 and 2 or length(after_cursor->>'label')>400 or length(after_cursor->>'key')>40) then raise exception 'Invalid roster cursor. Reset the list.';end if;
 with scoped as materialized (
 select a.user_id client_id,p.id profile_id,p.nickname,p.age_group,p.position,ac.coach_id,
 case when actor_role in ('owner','manager') then u.email else 'Client '||left(a.user_id::text,8) end client_label,
 cu.email coach_label,public.learning_search(coalesce(p.nickname,u.email)) label,case when p.id is null then 'c:'||a.user_id else 'p:'||p.id end row_key
 from public.member_accounts a join auth.users u on u.id=a.user_id join public.account_roles ar on ar.user_id=a.user_id
 left join public.player_profiles p on p.owner_id=a.user_id left join public.athlete_service_coaches ac on ac.profile_id=p.id left join auth.users cu on cu.id=ac.coach_id
 where ar.role in ('parent','athlete') and not public.account_is_closing(a.user_id)
 and ((actor_role in ('owner','manager') and (p.id is null or public.staff_can_view_service_athlete(p.id))) or (actor_role='coach' and p.id is not null and public.staff_can_view_service_athlete(p.id)))
 ), searched as materialized (
 select * from scoped s where (age_filter='' or s.age_group=age_filter) and (position_filter='' or s.position=position_filter) and (coach_filter='' or (coach_filter='none' and s.coach_id is null) or s.coach_id::text=coach_filter)
 and not exists(select 1 from regexp_split_to_table(public.learning_search(search_text),'\s+') word where word<>'' and strpos(public.learning_search(concat_ws(' ',s.nickname,s.client_label,s.position,s.coach_label)),word)=0)
 ), light as materialized (
 select s.*,case when s.profile_id is null then null else public.learning_staff_summary(s.profile_id) end learning,
 (select count(*) from public.review_services rs where rs.profile_id=s.profile_id and rs.state not in ('delivered','cancelled') and rs.due_at<=now() and (actor_role in ('owner','manager') or rs.assigned_to=auth.uid())) overdue,
 (select count(*) from public.review_services rs where rs.profile_id=s.profile_id and rs.state not in ('delivered','cancelled') and rs.blocker<>'none' and (actor_role in ('owner','manager') or rs.assigned_to=auth.uid())) blocked
 from searched s
 ), ranked as materialized (
 select l.*,case when overdue>0 then 0 when profile_id is null or coach_id is null or blocked>0 or learning->>'status' not in ('ready','week_complete','plan_complete','awaiting_release') then 1 else 2 end priority from light l
 ), matched as materialized (
 select * from ranked where status_filter='all' or (status_filter='overdue' and priority=0) or (status_filter='blocked' and priority=1) or (status_filter='ready' and priority=2) or (status_filter='unassigned' and coach_id is null)
 ), bounded as materialized (
 select * from matched where after_cursor is null or (priority,label collate "C",row_key) > ((after_cursor->>'priority')::integer,(after_cursor->>'label') collate "C",after_cursor->>'key') order by priority,label collate "C",row_key limit page_size+1
 ), displayed as materialized (select * from bounded order by priority,label collate "C",row_key limit page_size)
 select jsonb_build_object('source','account_backend','scope',case when actor_role='coach' then 'assigned_athletes' else 'all_repformed_clients' end,
 'rows',coalesce((select jsonb_agg(case when d.profile_id is null then jsonb_build_object('client_id',d.client_id,'client_label',d.client_label,'athlete_id',null,'athlete_name',null,'next_action','Complete private athlete setup') else public.staff_athlete_service(d.profile_id) end order by d.priority,d.label collate "C",d.row_key) from displayed d),'[]'),
 'coaches',case when actor_role in ('owner','manager') then coalesce((select jsonb_agg(jsonb_build_object('id',ar.user_id,'label',u.email) order by u.email) from public.account_roles ar join auth.users u on u.id=ar.user_id where ar.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(ar.user_id)),'[]') else coalesce((select jsonb_agg(jsonb_build_object('id',c.coach_id,'label',c.coach_label) order by c.coach_label) from (select distinct coach_id,coach_label from scoped where coach_id is not null) c),'[]') end,
 'page',jsonb_build_object('total',(select count(*) from ranked),'matched',(select count(*) from matched),'athletes',(select count(*) from scoped where profile_id is not null),'clients',(select count(distinct client_id) from scoped),
 'counts',jsonb_build_object('overdue',(select count(*) from ranked where priority=0),'attention',(select count(*) from ranked where priority=1),'ready',(select count(*) from ranked where priority=2)),
 'ages',coalesce((select jsonb_agg(age_group order by age_group) from (select distinct age_group from scoped where age_group is not null) a),'[]'),'positions',coalesce((select jsonb_agg(position order by position) from (select distinct position from scoped where position is not null) p),'[]'),
 'next_cursor',case when (select count(*) from bounded)>page_size then (select jsonb_build_object('priority',priority,'label',label,'key',row_key) from displayed order by priority desc,label collate "C" desc,row_key desc limit 1) end)) into result;
 return result;
end$$;
revoke all on function public.learning_search(text),public.learning_staff_summary(uuid),public.staff_athlete_service(uuid),public.staff_learning_roster_page(text,text,text,text,text,jsonb,integer) from public,anon;
grant execute on function public.staff_athlete_service(uuid),public.staff_learning_roster_page(text,text,text,text,text,jsonb,integer) to authenticated;
create or replace function public.learning_save_cohort(target_id uuid,cohort_title text,profiles uuid[]) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.learning_require_owner();perform pg_advisory_xact_lock(hashtextextended(target_id::text,2121));if cardinality(profiles)>500 or exists(select 1 from unnest(profiles) p where not public.learning_profile_allowed(p)) then raise exception 'Choose at most 500 in-scope athletes.';end if;
 insert into public.learning_cohorts values(target_id,trim(cohort_title),auth.uid()) on conflict(id) do update set title=excluded.title;
 delete from public.learning_cohort_members where cohort_id=target_id;
 insert into public.learning_cohort_members select target_id,p from (select distinct unnest(profiles) p) s;
end$$;
create function public.learning_group_enrollment_preview(target_cohort uuid,target_plan uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p uuid;current_plan uuid;status text;rows jsonb:='[]';new_count integer:=0;kept integer:=0;blocked integer:=0;label text;
begin
 perform public.learning_require_owner();if not exists(select 1 from public.learning_plans where id=target_plan) then raise exception 'Choose a plan.';end if;
 for p in select profile_id from public.learning_cohort_members where cohort_id=target_cohort order by profile_id loop
  if not public.learning_profile_allowed(p) then status:='unavailable';label:='Unavailable athlete';blocked:=blocked+1;
  else
   select nickname into label from public.player_profiles where id=p;
   select plan_id into current_plan from public.learning_enrollments where profile_id=p and state in ('active','paused','finished') order by created_at desc,id desc limit 1;
   if current_plan=target_plan then status:='keep_existing';kept:=kept+1;
   elsif exists(select 1 from public.learning_enrollments where profile_id=p and state in ('active','paused')) then status:='different_running_plan';blocked:=blocked+1;
   elsif not public.learning_eligible(p,target_plan,now()) then status:='eligibility_needed';blocked:=blocked+1;
   else status:='new_enrollment';new_count:=new_count+1;end if;
  end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('name',label,'state',status));
 end loop;
 if jsonb_array_length(rows)=0 then raise exception 'Group has no available athletes.';end if;
 return jsonb_build_object('members',rows,'new_count',new_count,'kept_count',kept,'blocked_count',blocked);
end$$;
create or replace function public.learning_enroll_cohort(target_cohort uuid,target_plan uuid,operation_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare p uuid;n integer:=0;existing integer;preview jsonb;begin
 perform public.learning_require_owner();perform pg_advisory_xact_lock(hashtextextended(target_cohort::text,2121));perform pg_advisory_xact_lock(hashtextextended(operation_id::text,1922));
 select count(*) into existing from public.learning_audit where action='enroll_cohort' and target=operation_id;
 if existing>0 then
  if not exists(select 1 from public.learning_audit where action='enroll_cohort' and target=operation_id and detail->>'cohort'=target_cohort::text and detail->>'plan'=target_plan::text) then raise exception 'Group operation ID already used.';end if;
  return (select (detail->>'count')::integer from public.learning_audit where action='enroll_cohort' and target=operation_id limit 1);
 end if;
 -- Lock every member before rechecking eligibility so partial enrollment cannot
 -- result from a concurrent single-athlete action. Historical plans stay intact.
 for p in select profile_id from public.learning_cohort_members where cohort_id=target_cohort order by profile_id loop perform pg_advisory_xact_lock(hashtextextended(p::text,1921));end loop;
 preview:=public.learning_group_enrollment_preview(target_cohort,target_plan);
 if (preview->>'blocked_count')::integer>0 then raise exception 'Group enrollment needs eligibility or a conflicting running plan resolved. Nobody was enrolled.';end if;
 for p in select profile_id from public.learning_cohort_members where cohort_id=target_cohort order by profile_id loop
  if (select plan_id from public.learning_enrollments where profile_id=p and state in ('active','paused','finished') order by created_at desc,id desc limit 1)=target_plan then continue;end if;
  perform public.learning_enroll(gen_random_uuid(),p,target_plan,true);n:=n+1;
 end loop;
 insert into public.learning_audit(actor_id,action,target,detail) values(auth.uid(),'enroll_cohort',operation_id,jsonb_build_object('count',n,'cohort',target_cohort,'plan',target_plan));return n;
end$$;
revoke all on function public.learning_group_enrollment_preview(uuid,uuid) from public,anon;
grant execute on function public.learning_group_enrollment_preview(uuid,uuid) to authenticated;
-- Internal summary/search are called only from the guarded definer endpoints.
revoke all on function public.learning_search(text),public.learning_staff_summary(uuid) from authenticated;
create or replace function public.learning_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform public.learning_require_staff();return jsonb_build_object('plans',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('weeks_content',coalesce((select jsonb_agg(to_jsonb(w)||jsonb_build_object('ready',public.learning_week_ready(w.id)) order by week_number,revision desc) from public.learning_week_versions w where w.plan_id=p.id),'[]'))) from public.learning_plans p where p.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'quizzes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'quiz_id',v.quiz_id,'title',q.title,'revision',v.revision,'questions',v.questions,'keys',k.keys,'total_points',v.total_points)) from public.learning_quiz_versions v join public.learning_quizzes q on q.id=v.quiz_id join public.learning_quiz_keys k on k.version_id=v.id where v.created_by=auth.uid() or q.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'rules',(select jsonb_build_object('friday_time',friday_time::text,'low_ready_weeks',low_ready_weeks) from public.learning_settings),'cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',p.nickname) order by p.nickname) from public.learning_cohort_members m join public.player_profiles p on p.id=m.profile_id where m.cohort_id=c.id and public.learning_profile_allowed(m.profile_id)),'[]'),'profiles',coalesce((select jsonb_agg(m.profile_id) from public.learning_cohort_members m where m.cohort_id=c.id and public.learning_profile_allowed(m.profile_id)),'[]'))) from public.learning_cohorts c where public.current_account_role() in ('owner','manager') or exists(select 1 from public.learning_cohort_members m where m.cohort_id=c.id and public.staff_can_view_service_athlete(m.profile_id))),'[]'));
end$$;
create or replace function public.learning_inbox() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'profile_id',n.profile_id,'athlete_name',(select nickname from public.player_profiles where id=n.profile_id),'next_due_at',(select next_release_at from public.learning_enrollments where profile_id=n.profile_id and state='active' order by created_at desc,id desc limit 1),'release_id',n.release_id,'category',n.category,'created_at',n.created_at,'read',exists(select 1 from public.learning_notice_reads r where r.notice_id=n.id and r.user_id=auth.uid())) order by n.created_at desc),'[]')
 from public.learning_notices n where n.resolved_at is null and public.learning_profile_allowed(n.profile_id) and ((n.staff_only and public.staff_can_view_service_athlete(n.profile_id) and exists(select 1 from public.learning_enrollments e where e.profile_id=n.profile_id and e.state='active' and public.learning_eligible(e.profile_id,e.plan_id,now())))
 or (not n.staff_only and public.can_view_athlete(n.profile_id) and exists(select 1 from public.learning_releases r join public.learning_enrollments e on e.id=r.enrollment_id where r.id=n.release_id and public.learning_eligible(e.profile_id,e.plan_id,now()) and (n.category<>'friday_incomplete' or (e.state in ('active','finished') and public.learning_can_submit(e.profile_id) and r.sequence=(select max(latest.sequence) from public.learning_releases latest where latest.enrollment_id=e.id))))))
$$;

commit;
