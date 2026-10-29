-- REVIEW DRAFT. Not installed or enabled by adding this file.
-- Standalone service-roster read path; requires the existing 015 service helpers.
-- Does NOT require or activate learning migrations 019-022, media grants or Cron.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$begin
 if to_regprocedure('public.staff_athlete_service(uuid)') is null
 or to_regprocedure('public.staff_can_view_service_athlete(uuid)') is null
 or to_regprocedure('public.effective_workout_assignment(uuid)') is null then
  raise exception 'Existing reviewed staff-service helpers must be present. Do not install unrelated drafts automatically.';
 end if;
end$$;
create index if not exists athlete_service_coaches_staff_page on public.athlete_service_coaches(coach_id,profile_id);
create index if not exists review_services_staff_page on public.review_services(profile_id,assigned_to,state,due_at);
create function public.staff_service_search(value text) returns text
language sql immutable set search_path='' as $$
 select lower(regexp_replace(normalize(coalesce(value,''),NFKD),U&'[\0300-\036f]','','g'))
$$;
revoke all on function public.staff_service_search(text) from public,anon,authenticated;
create function public.staff_client_service_roster_page(
 search_text text default '',status_filter text default 'all',age_filter text default '',
 position_filter text default '',coach_filter text default '',page_number integer default 1,page_size integer default 25
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor_role text;result jsonb;
begin
 actor_role:=public.current_account_role();
 if coalesce(actor_role,'') not in ('owner','manager','coach') or public.account_is_closing(auth.uid()) then
  raise exception 'Staff access is required.';
 end if;
 if search_text is null or length(search_text)>160 or status_filter is null
 or status_filter not in ('all','overdue','blocked','ready','unassigned')
 or age_filter is null or length(age_filter)>80 or position_filter is null or length(position_filter)>80
 or coach_filter is null or (coach_filter not in ('','none') and coach_filter !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 or page_number is null or page_number not between 1 and 1000000
 or page_size is null or page_size not between 1 and 100 then
  raise exception 'Choose valid roster filters, a positive page, and a page size from 1 to 100.';
 end if;
 with scoped as materialized (
  select a.user_id client_id,p.id profile_id,p.nickname,p.age_group,p.position,ac.coach_id,
   case when actor_role in ('owner','manager') then u.email else 'Client '||left(a.user_id::text,8) end client_label,
   cu.email coach_label,case when p.id is null then 'c:'||a.user_id::text else 'p:'||p.id::text end row_key
  from public.member_accounts a join auth.users u on u.id=a.user_id join public.account_roles ar on ar.user_id=a.user_id
  left join public.player_profiles p on p.owner_id=a.user_id
  left join public.athlete_service_coaches ac on ac.profile_id=p.id left join auth.users cu on cu.id=ac.coach_id
  where ar.role in ('parent','athlete') and not public.account_is_closing(a.user_id)
   and ((actor_role in ('owner','manager') and (p.id is null or public.staff_can_view_service_athlete(p.id)))
    or (actor_role='coach' and p.id is not null and public.staff_can_view_service_athlete(p.id)))
 ), review_counts as materialized (
  select rs.profile_id,
   count(*) filter(where rs.due_at<=now())::integer overdue,
   count(*) filter(where rs.blocker<>'none')::integer blocked
  from public.review_services rs join scoped s on s.profile_id=rs.profile_id
  where rs.state not in ('delivered','cancelled') and (actor_role in ('owner','manager') or rs.assigned_to=auth.uid())
  group by rs.profile_id
 ), assigned as materialized (
  select s.*,public.effective_workout_assignment(s.profile_id) assignment,
   coalesce(r.overdue,0) overdue,coalesce(r.blocked,0) blocked
  from scoped s left join review_counts r on r.profile_id=s.profile_id
 ), readiness as materialized (
  select a.*,coalesce((a.assignment).workout_id is not null and public.workout_matches_athlete(a.profile_id,(a.assignment).resource_ids),false) eligible,
   coalesce(cardinality((a.assignment).resource_ids)>0 and not exists(
    select 1 from unnest((a.assignment).resource_ids) resource_id where not exists(
     select 1 from public.training_resources tr join storage.objects o on o.bucket_id='training-media' and o.name=tr.asset_path
      and coalesce((o.metadata->>'size')::bigint,0)>0 and o.metadata->>'mimetype'=tr.asset_type
     where tr.id=resource_id)),false) media_ready
  from assigned a
 ), ranked as materialized (
  select r.*,case when overdue>0 then 0
   when profile_id is null or coach_id is null or (assignment).workout_id is null or blocked>0 or not eligible or not media_ready then 1 else 2 end priority,
   public.staff_service_search(coalesce(nickname,client_label)) label
  from readiness r
 ), matched as materialized (
  select * from ranked r where (age_filter='' or age_group=age_filter) and (position_filter='' or position=position_filter)
   and (coach_filter='' or (coach_filter='none' and coach_id is null) or coach_id::text=coach_filter)
   and (status_filter='all' or (status_filter='overdue' and priority=0) or (status_filter='blocked' and priority=1)
    or (status_filter='ready' and priority=2) or (status_filter='unassigned' and coach_id is null))
   and not exists(select 1 from regexp_split_to_table(public.staff_service_search(search_text),'\s+') word
    where word<>'' and strpos(public.staff_service_search(concat_ws(' ',nickname,client_label,position,coach_label,(assignment).workout_title)),word)=0)
 ), pagination as materialized (
  select count(*)::integer matched,greatest(1,ceil(count(*)::numeric/page_size)::integer) pages,
   least(page_number,greatest(1,ceil(count(*)::numeric/page_size)::integer)) number from matched
 ), displayed as materialized (
  select * from matched order by priority,label collate "C",row_key
  limit page_size offset ((select number from pagination)-1)*page_size
 )
 select jsonb_build_object('source','account_backend','scope',case when actor_role='coach' then 'assigned_athletes' else 'all_repformed_clients' end,
  -- Expand rich resources/review history only AFTER selecting the bounded page.
  'rows',coalesce((select jsonb_agg(case when d.profile_id is null then jsonb_build_object('client_id',d.client_id,'client_label',d.client_label,'athlete_id',null,'athlete_name',null,'next_action','Complete private athlete setup') else public.staff_athlete_service(d.profile_id) end order by d.priority,d.label collate "C",d.row_key) from displayed d),'[]'::jsonb),
  'coaches',case when actor_role in ('owner','manager') then coalesce((select jsonb_agg(jsonb_build_object('id',ar.user_id,'label',u.email) order by u.email) from public.account_roles ar join auth.users u on u.id=ar.user_id where ar.role in ('owner','manager','coach') and u.email_confirmed_at is not null and not public.account_is_closing(ar.user_id)),'[]'::jsonb) else '[]'::jsonb end,
  'page',jsonb_build_object('number',(select number from pagination),'size',page_size,'pages',(select pages from pagination),
   'total',(select count(*) from scoped),'matched',(select matched from pagination),
   'athletes',(select count(*) from scoped where profile_id is not null),'clients',(select count(distinct client_id) from scoped),
   'counts',jsonb_build_object('overdue',(select count(*) from ranked where priority=0),'attention',(select count(*) from ranked where priority=1),'ready',(select count(*) from ranked where priority=2)),
   'ages',coalesce((select jsonb_agg(age_group order by age_group) from (select distinct age_group from scoped where age_group is not null) a),'[]'::jsonb),
   'positions',coalesce((select jsonb_agg(position order by position) from (select distinct position from scoped where position is not null) p),'[]'::jsonb),
   'coaches',coalesce((select jsonb_agg(jsonb_build_object('id',coach_id,'label',coach_label) order by coach_label) from (select distinct coach_id,coach_label from scoped where coach_id is not null) c),'[]'::jsonb))) into result;
 return result;
end$$;
revoke all on function public.staff_client_service_roster_page(text,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.staff_client_service_roster_page(text,text,text,text,text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
