-- REVIEW DRAFT: storage-policy change, requires separate production approval.
-- Retains existing original media referenced by approved learning snapshots.
-- No bucket, quota increase, deletion job or migration of existing files.
begin;
create function public.learning_media_retained(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_week_versions w cross join jsonb_array_elements(w.resources) x where w.approved_at is not null and x->>'asset_path'=path)
$$;
create function public.learning_media_allowed(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_releases r join public.learning_week_versions w on w.id=r.week_version_id cross join jsonb_array_elements(w.resources) x where x->>'asset_path'=path and public.learning_release_allowed(r.id,true))
$$;
revoke all on function public.learning_media_retained(text),public.learning_media_allowed(text) from public,anon;
grant execute on function public.learning_media_retained(text),public.learning_media_allowed(text) to authenticated;
create policy "Read active released learning media" on storage.objects for select to authenticated using(bucket_id='training-media' and public.learning_media_allowed(name));
create policy "Retain approved learning snapshot media" on storage.objects as restrictive for delete to authenticated using(bucket_id<>'training-media' or not public.learning_media_retained(name));
-- Prevent replacing bytes at the same retained path through any future UPSERT policy.
create policy "Do not overwrite approved learning media" on storage.objects as restrictive for update to authenticated using(bucket_id<>'training-media' or not public.learning_media_retained(name)) with check(bucket_id<>'training-media' or not public.learning_media_retained(name));
commit;
