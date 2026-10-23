-- REVIEW BEFORE APPLYING. This file has not been run against a live service.
-- Use a separate, empty Supabase project for Player Development only.
begin;

create table public.coach_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.coach_members enable row level security;
revoke all on public.coach_members from anon, authenticated;
grant select on public.coach_members to authenticated;
create policy "Coaches can check their own membership" on public.coach_members
  for select to authenticated using (user_id = auth.uid());
-- No browser policy grants INSERT, UPDATE or DELETE on the membership allowlist.

create function public.valid_training_content(d jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(d) = 'object'
    and d->>'sport' = 'football'
    and length(btrim(d->>'title')) between 1 and 90
    and d->>'skill' in ('Coordination', 'Footwork', 'Ball skills', 'Game understanding')
    and jsonb_typeof(d->'ages') = 'array' and jsonb_array_length(d->'ages') between 1 and 4
    and not exists (select 1 from jsonb_array_elements_text(d->'ages') a where a not in ('5–7', '8–12', '13–17', '18+'))
    and jsonb_typeof(d->'levels') = 'array' and jsonb_array_length(d->'levels') between 1 and 3
    and not exists (select 1 from jsonb_array_elements_text(d->'levels') l where l not in ('New to the game', 'Building fundamentals', 'Experienced'))
    and jsonb_typeof(d->'positions') = 'array' and jsonb_array_length(d->'positions') <= 8
    and not exists (select 1 from jsonb_array_elements_text(d->'positions') p where p not in ('Explore all positions', 'Quarterback', 'Wide receiver', 'Running back', 'Offensive line', 'Defensive line', 'Linebacker', 'Defensive back'))
    and jsonb_typeof(d->'minutes') = 'number' and (d->>'minutes')::numeric between 1 and 20
    and jsonb_typeof(d->'steps') = 'array' and jsonb_array_length(d->'steps') between 1 and 100
    and not exists (select 1 from jsonb_array_elements(d->'steps') s where jsonb_typeof(s) <> 'string' or length(btrim(s #>> '{}')) not between 1 and 4000)
    and length((d->'steps')::text) <= 10000
    and jsonb_typeof(d->'equipment') = 'string' and length(d->>'equipment') <= 500
    and jsonb_typeof(d->'lesson') = 'string' and length(d->>'lesson') <= 2000
    and jsonb_typeof(d->'cue') = 'string' and length(d->>'cue') <= 500
    and d->>'kind' in ('movement', 'hands', 'read');
$$;

create table public.training_resources (
  id uuid primary key,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  content jsonb not null check (public.valid_training_content(content) is true),
  asset_path text not null unique check (asset_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm|png|jpg|webp|pdf|txt)$'),
  asset_type text not null check (asset_type in ('video/mp4','video/webm','image/png','image/jpeg','image/webp','application/pdf','text/plain')),
  asset_name text not null check (length(asset_name) between 1 and 180)
);
create function public.bump_training_resource_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger training_resource_version before update on public.training_resources
  for each row execute function public.bump_training_resource_version();
alter table public.training_resources enable row level security;
revoke all on public.training_resources from anon, authenticated;
grant select on public.training_resources to anon;
grant select, insert, update, delete on public.training_resources to authenticated;
create policy "Visitors read published training only" on public.training_resources
  for select to authenticated using (status = 'published' or exists (select 1 from public.coach_members where user_id = auth.uid()));
create policy "Visitors read published training" on public.training_resources
  for select to anon using (status = 'published');
create policy "Approved coaches create training" on public.training_resources
  for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.coach_members where user_id = auth.uid()));
create policy "Approved coaches edit training" on public.training_resources
  for update to authenticated using (exists (select 1 from public.coach_members where user_id = auth.uid()))
  with check (exists (select 1 from public.coach_members where user_id = auth.uid()));
create policy "Approved coaches remove training" on public.training_resources
  for delete to authenticated using (exists (select 1 from public.coach_members where user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-media', 'training-media', false, 12582912, array['video/mp4','video/webm','image/png','image/jpeg','image/webp','application/pdf','text/plain']);
create policy "Published training media can be signed for reading" on storage.objects
  for select to authenticated using (bucket_id = 'training-media' and (
    exists (select 1 from public.training_resources r where r.asset_path = name and r.status = 'published')
    or exists (select 1 from public.coach_members where user_id = auth.uid())
  ));
create policy "Visitors read published training media" on storage.objects
  for select to anon using (bucket_id = 'training-media' and exists (select 1 from public.training_resources r where r.asset_path = name and r.status = 'published'));
create policy "Approved coaches upload to their own folder" on storage.objects
  for insert to authenticated with check (bucket_id = 'training-media' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.coach_members where user_id = auth.uid()));
create policy "Approved coaches remove training media" on storage.objects
  for delete to authenticated using (bucket_id = 'training-media' and exists (select 1 from public.coach_members where user_id = auth.uid()));

commit;
