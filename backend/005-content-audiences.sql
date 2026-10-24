-- Apply once after 001–004 to the dedicated Player Development project.
-- Shared uploads default to protected staff review, including existing uploads.
-- Only explicit public samples are free; paid entitlements are not activated.
begin;
alter table public.training_resources add column visibility text;
update public.training_resources set visibility='member_only';
alter table public.training_resources alter column visibility set not null;
alter table public.training_resources alter column visibility set default 'member_only';
alter table public.training_resources add constraint training_visibility check(visibility in ('public_sample','member_only'));

drop policy "Visitors read published training" on public.training_resources;
create policy "Visitors read public samples" on public.training_resources for select to anon using(status='published' and visibility='public_sample');
drop policy "Staff read permitted training" on public.training_resources;
create policy "Read public samples or editable protected content" on public.training_resources for select to authenticated using((status='published' and visibility='public_sample') or public.can_edit_training(created_by));

drop policy "Visitors read published training media" on storage.objects;
create policy "Visitors read public sample media" on storage.objects for select to anon using(bucket_id='training-media' and exists(select 1 from public.training_resources r where r.asset_path=name and r.status='published' and r.visibility='public_sample'));
drop policy "Members read permitted media" on storage.objects;
create policy "Staff read permitted protected media" on storage.objects for select to authenticated using(bucket_id='training-media' and (
 exists(select 1 from public.training_resources r where r.asset_path=name and ((r.status='published' and r.visibility='public_sample') or public.can_edit_training(r.created_by)))
 or public.current_account_role() in ('owner','manager')
 or (public.current_account_role()='coach' and (storage.foldername(name))[1]=auth.uid()::text)
));
-- No browser role can purchase or grant itself entitlements. Ordinary signed-in
-- accounts cannot read protected metadata or request signed media URLs.
notify pgrst,'reload schema';
commit;
