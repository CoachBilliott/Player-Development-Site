-- DRAFT ONLY. Requires019–021; not applied to hosted test or production.
-- Validates official WEEKLY package allocations. No flag/Cron/role/quota change.
-- A new guarded save RPC carries classification and per-IQ quiz links.
-- Historical releases/grades and original immutable week versions are not rewritten.
begin;
create function public.learning_package_requirements(packages text[]) returns jsonb
language plpgsql immutable set search_path='' as $$
declare classes text[];level text;
begin
 if packages is null or cardinality(packages)=0 or exists(select 1 from unnest(packages) p where p is null or p not in ('foundation','fundamentals','position-development','elite-coaching','private_test')) then
  return jsonb_build_object('mode','invalid','error','Choose a configured package for the plan.');end if;
 select array_agg(distinct case p when 'foundation' then 'foundation' when 'fundamentals' then 'fundamentals' when 'private_test' then 'test' else 'position' end) into classes from unnest(packages) p;
 if cardinality(classes)<>1 then return jsonb_build_object('mode','invalid','error','Use separate plans for packages with different weekly workloads. Position Development and Elite may share their weekly content.');end if;
 level:=classes[1];
 if level='test' then return jsonb_build_object('mode','test','iq',0,'movement',0,'position',0,'quizzes',0);end if;
 return jsonb_build_object('mode','package','iq',2,'quizzes',2,'movement',case when level='foundation' then 0 else 2 end,'position',case when level='position' then 2 else 0 end);
end$$;

create function public.learning_week_readiness(target_week uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare w public.learning_week_versions;p public.learning_plans;required jsonb;actual jsonb;missing jsonb:='[]';mode text;iq_count integer;movement_count integer;position_count integer;unclassified integer;quiz_count integer;linked integer;bad_iq integer;assets_ok boolean;category text;wanted integer;found_count integer;label text;complete boolean;
begin
 select * into w from public.learning_week_versions where id=target_week;
 if not found then return jsonb_build_object('mode','invalid','complete',false,'ready',false,'missing',jsonb_build_array('Week not found.'));end if;
 select * into strict p from public.learning_plans where id=w.plan_id;
 required:=public.learning_package_requirements(p.package_ids);mode:=required->>'mode';
 select count(*) filter(where x->>'learning_kind'='iq'),count(*) filter(where x->>'learning_kind'='movement'),count(*) filter(where x->>'learning_kind'='position'),count(*) filter(where coalesce(x->>'learning_kind','') not in ('iq','movement','position'))
 into iq_count,movement_count,position_count,unclassified from jsonb_array_elements(w.resources) x;
 quiz_count:=cardinality(w.quiz_version_ids);
 actual:=jsonb_build_object('iq',iq_count,'movement',movement_count,'position',position_count,'quizzes',quiz_count);
 if mode='invalid' then missing:=missing||jsonb_build_array(required->>'error');
 elsif w.week_number=0 then mode:='orientation';
 elsif mode='package' then
  if unclassified>0 then missing:=missing||jsonb_build_array(format('Classify %s selected lesson(s) as IQ, movement or position.',unclassified));end if;
  foreach category in array array['iq','movement','position','quizzes'] loop
   wanted:=(required->>category)::integer;found_count:=(actual->>category)::integer;
   label:=case category when 'iq' then 'Football-IQ lessons' when 'movement' then 'Movement sessions' when 'position' then 'Additional position drills' else 'Lesson quizzes' end;
   if found_count<>wanted then missing:=missing||jsonb_build_array(format('%s: %s selected; package requires %s.',label,found_count,wanted));end if;
  end loop;
  select count(distinct x->>'lesson_quiz_id') into linked from jsonb_array_elements(w.resources) x
   where x->>'learning_kind'='iq' and x->>'lesson_quiz_id'=any(w.quiz_version_ids::text[]);
  if linked<>iq_count or exists(select 1 from jsonb_array_elements(w.resources) x where x->>'learning_kind'='iq' and (x->>'lesson_quiz_id' is null or not coalesce(x->>'lesson_quiz_id'=any(w.quiz_version_ids::text[]),false))) then
   missing:=missing||jsonb_build_array('Link a different included quiz version to each football-IQ lesson.');end if;
  select count(*) into bad_iq from jsonb_array_elements(w.resources) x where x->>'learning_kind'='iq' and coalesce(x->>'asset_type','') not like 'video/%';
  if bad_iq>0 then missing:=missing||jsonb_build_array(format('%s football-IQ lesson(s) need video media.',bad_iq));end if;
 end if;
 assets_ok:=not exists(select 1 from jsonb_array_elements(w.resources) s where not exists(
  select 1 from public.training_resources r join storage.objects o on o.bucket_id='training-media' and o.name=r.asset_path
  where r.id=(s->>'id')::uuid and r.version=(s->>'version')::integer and r.status='published' and r.review_stage='approved'
  and r.asset_path=s->>'asset_path' and coalesce((o.metadata->>'size')::bigint,0)>0 and o.metadata->>'mimetype'=r.asset_type));
 if not assets_ok then missing:=missing||jsonb_build_array('All selected uploads must be complete, approved and unchanged.');end if;
 if w.retracted_at is not null then missing:=missing||jsonb_build_array('This week version was withdrawn.');end if;
 complete:=jsonb_array_length(missing)=0;
 return jsonb_build_object('mode',mode,'complete',complete,'ready',complete and w.approved_at is not null,'missing',missing,'required',required,'actual',actual);
end$$;
create or replace function public.learning_week_ready(target_week uuid) returns boolean
language sql stable security definer set search_path='' as $$select coalesce((public.learning_week_readiness(target_week)->>'ready')::boolean,false)$$;

create function public.learning_save_week_checked(target_id uuid,target_plan uuid,week_no integer,week_title text,resource_ids uuid[],quizzes uuid[],lesson_allocations jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.learning_plans;snapshots jsonb;rev integer;entry record;kind text;quiz_ref text;
begin
 perform public.learning_require_staff();select * into strict p from public.learning_plans where id=target_plan;
 if p.created_by<>auth.uid() and public.current_account_role() not in ('owner','manager') then raise exception 'Plan is outside your authoring scope.';end if;
 if resource_ids is null or quizzes is null or week_no<0 or week_no>p.weeks or cardinality(resource_ids)>24 or cardinality(quizzes)>8 or cardinality(resource_ids)+cardinality(quizzes)<1 or array_position(resource_ids,null) is not null or array_position(quizzes,null) is not null then raise exception 'Choose 1–24 lessons and at most 8 quizzes for this week.';end if;
 if (select count(distinct x) from unnest(resource_ids) x)<>cardinality(resource_ids) or (select count(distinct x) from unnest(quizzes) x)<>cardinality(quizzes) then raise exception 'Remove duplicate items.';end if;
 if exists(select 1 from unnest(resource_ids) rid left join public.training_resources r on r.id=rid where r.id is null or (r.created_by<>auth.uid() and public.current_account_role() not in ('owner','manager'))) then raise exception 'Choose resources in your authoring scope.';end if;
 if exists(select 1 from unnest(quizzes) qid left join public.learning_quiz_versions v on v.id=qid where v.id is null or (v.created_by<>auth.uid() and public.current_account_role() not in ('owner','manager'))) then raise exception 'Choose quiz versions in your authoring scope.';end if;
 if lesson_allocations is null or jsonb_typeof(lesson_allocations)<>'object' then raise exception 'Invalid lesson classification.';end if;
 if (select count(*) from jsonb_object_keys(lesson_allocations))>24 then raise exception 'Too many lesson classifications.';end if;
 for entry in select key,value from jsonb_each(lesson_allocations) loop
  if not entry.key=any(resource_ids::text[]) or jsonb_typeof(entry.value)<>'object' or exists(select 1 from jsonb_object_keys(entry.value) k where k not in ('kind','quiz_version_id')) then raise exception 'Classify only selected lessons using the supported fields.';end if;
  kind:=entry.value->>'kind';quiz_ref:=entry.value->>'quiz_version_id';
  if kind is not null and kind not in ('iq','movement','position') then raise exception 'Choose IQ, movement or position.';end if;
  if quiz_ref is not null and (kind is distinct from 'iq' or not coalesce(quiz_ref=any(quizzes::text[]),false)) then raise exception 'Only IQ lessons may link an included quiz version.';end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'content',r.content,'asset_path',r.asset_path,'asset_type',r.asset_type,'asset_name',r.asset_name)||jsonb_strip_nulls(jsonb_build_object('learning_kind',lesson_allocations->r.id::text->>'kind','lesson_quiz_id',lesson_allocations->r.id::text->>'quiz_version_id')) order by ord),'[]') into snapshots from unnest(resource_ids) with ordinality i(id,ord) join public.training_resources r on r.id=i.id;
 perform pg_advisory_xact_lock(hashtextextended(target_plan::text,1920));
 if exists(select 1 from public.learning_week_versions where id=target_id) then
  if exists(select 1 from public.learning_week_versions w where w.id=target_id and w.created_by=auth.uid() and w.plan_id=target_plan and w.week_number=week_no and w.title=trim(week_title) and w.resources=snapshots and w.quiz_version_ids=quizzes) then return target_id;end if;
  raise exception 'Week ID already exists with different data.';
 end if;
 select coalesce(max(revision),0)+1 into rev from public.learning_week_versions where plan_id=target_plan and week_number=week_no;
 insert into public.learning_week_versions(id,plan_id,week_number,revision,title,resources,quiz_version_ids,created_by) values(target_id,target_plan,week_no,rev,trim(week_title),snapshots,quizzes,auth.uid());
 return target_id;
end$$;
create or replace function public.learning_save_week(target_id uuid,target_plan uuid,week_no integer,week_title text,resource_ids uuid[],quizzes uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$begin
 -- Legacy callers can save drafts, but missing classifications cannot approve
 -- or release a normal package week. An explicit private_test plan is not a package.
 return public.learning_save_week_checked(target_id,target_plan,week_no,week_title,resource_ids,quizzes,'{}');
end$$;
create or replace function public.learning_approve_week(target_week uuid) returns void language plpgsql security definer set search_path='' as $$
declare status jsonb;detail text;begin
 perform public.learning_require_staff();if public.current_account_role() not in ('owner','manager') then raise exception 'Owner or Manager approval is required.';end if;
 update public.learning_week_versions set approved_at=coalesce(approved_at,now()),approved_by=coalesce(approved_by,auth.uid()) where id=target_week;
 if not found then raise exception 'Week not found.';end if;
 status:=public.learning_week_readiness(target_week);
 if not (status->>'ready')::boolean then select string_agg(value,' ') into detail from jsonb_array_elements_text(status->'missing');raise exception 'Week not ready: %',detail;end if;
 insert into public.learning_audit(actor_id,action,target) values(auth.uid(),'approve_week',target_week);
end$$;
create or replace function public.learning_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform public.learning_require_staff();return jsonb_build_object('plans',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('weeks_content',coalesce((select jsonb_agg(to_jsonb(w)||jsonb_build_object('ready',public.learning_week_ready(w.id),'readiness',public.learning_week_readiness(w.id)) order by week_number,revision desc) from public.learning_week_versions w where w.plan_id=p.id),'[]'))) from public.learning_plans p where p.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'quizzes',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'quiz_id',v.quiz_id,'title',q.title,'revision',v.revision,'questions',v.questions,'keys',k.keys,'total_points',v.total_points)) from public.learning_quiz_versions v join public.learning_quizzes q on q.id=v.quiz_id join public.learning_quiz_keys k on k.version_id=v.id where v.created_by=auth.uid() or q.created_by=auth.uid() or public.current_account_role() in ('owner','manager')),'[]'),
 'rules',(select jsonb_build_object('friday_time',friday_time::text,'low_ready_weeks',low_ready_weeks) from public.learning_settings),'cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',p.nickname) order by p.nickname) from public.learning_cohort_members m join public.player_profiles p on p.id=m.profile_id where m.cohort_id=c.id and public.learning_profile_allowed(m.profile_id)),'[]'),'profiles',coalesce((select jsonb_agg(m.profile_id) from public.learning_cohort_members m where m.cohort_id=c.id and public.learning_profile_allowed(m.profile_id)),'[]'))) from public.learning_cohorts c where public.current_account_role() in ('owner','manager') or exists(select 1 from public.learning_cohort_members m where m.cohort_id=c.id and public.staff_can_view_service_athlete(m.profile_id))),'[]'));
end$$;
revoke all on function public.learning_package_requirements(text[]),public.learning_week_readiness(uuid),public.learning_save_week_checked(uuid,uuid,integer,text,uuid[],uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.learning_save_week_checked(uuid,uuid,integer,text,uuid[],uuid[],jsonb) to authenticated;
-- Existing authenticated save/approve/catalog scopes are unchanged; helpers stay internal.
-- No replacement of release_allowed: historical released versions/grades remain readable
-- under existing household/coach/eligibility/withdrawal checks. Only future readiness changes.
commit;
