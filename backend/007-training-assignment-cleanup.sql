-- Apply once after 006. Keep manual access editable when content is withdrawn.
begin;
create function public.prune_withdrawn_training_assignments() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.status='published' and new.visibility='member_only' then return new; end if;
 end if;
 update public.member_training_access a set resource_ids=array_remove(a.resource_ids,old.id),version=a.version+1,updated_at=now(),updated_by=auth.uid() where old.id=any(a.resource_ids);
 if TG_OP='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function public.prune_withdrawn_training_assignments() from public,anon,authenticated;
create trigger withdrawn_training_access_cleanup after delete or update of status,visibility on public.training_resources for each row execute function public.prune_withdrawn_training_assignments();
-- Remove pre-existing obsolete references, without adding or exposing any content.
update public.member_training_access a set resource_ids=array(select entry.resource_id from unnest(a.resource_ids) as entry(resource_id) where exists(select 1 from public.training_resources r where r.id=entry.resource_id and r.status='published' and r.visibility='member_only')),version=a.version+1,updated_at=now()
where exists(select 1 from unnest(a.resource_ids) as entry(resource_id) where not exists(select 1 from public.training_resources r where r.id=entry.resource_id and r.status='published' and r.visibility='member_only'));
notify pgrst,'reload schema';
commit;
