-- =====================================================================
-- CAREER FAIR – CLASS-WISE AR PHOTO GALLERY  |  Supabase setup
-- Run this whole file once in: Supabase Dashboard > SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- It does NOT touch any of your existing tables.
-- =====================================================================

-- 1. Admin list ---------------------------------------------------------
create table if not exists public.career_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.career_admins enable row level security;

-- Helper: is the current logged-in user an admin?
create or replace function public.is_career_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.career_admins where user_id = auth.uid());
$$;
grant execute on function public.is_career_admin() to anon, authenticated;

drop policy if exists "admins read admin list" on public.career_admins;
create policy "admins read admin list" on public.career_admins
  for select to authenticated
  using (user_id = auth.uid());
-- No insert/update/delete policies: admins are added only via SQL Editor.

-- 2. Photos table -------------------------------------------------------
create table if not exists public.ar_photos (
  id           uuid primary key default gen_random_uuid(),
  class_level  text not null,
  career_name  text not null,
  description  text not null default '',
  storage_path text not null unique,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  uploaded_by  uuid references auth.users(id) on delete set null,
  constraint ar_photos_class_level_check
    check (class_level in ('class-9','class-10','class-11','class-12'))
);

create index if not exists ar_photos_class_idx     on public.ar_photos (class_level, is_published);
create index if not exists ar_photos_created_idx   on public.ar_photos (created_at desc);

-- Auto-update updated_at
create or replace function public.ar_photos_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists ar_photos_touch_trg on public.ar_photos;
create trigger ar_photos_touch_trg
  before update on public.ar_photos
  for each row execute function public.ar_photos_touch();

-- 3. Row Level Security on ar_photos -----------------------------------
alter table public.ar_photos enable row level security;

drop policy if exists "public read published" on public.ar_photos;
create policy "public read published" on public.ar_photos
  for select to anon, authenticated
  using (is_published = true);

drop policy if exists "admin read all" on public.ar_photos;
create policy "admin read all" on public.ar_photos
  for select to authenticated
  using (public.is_career_admin());

drop policy if exists "admin insert" on public.ar_photos;
create policy "admin insert" on public.ar_photos
  for insert to authenticated
  with check (public.is_career_admin());

drop policy if exists "admin update" on public.ar_photos;
create policy "admin update" on public.ar_photos
  for update to authenticated
  using (public.is_career_admin())
  with check (public.is_career_admin());

drop policy if exists "admin delete" on public.ar_photos;
create policy "admin delete" on public.ar_photos
  for delete to authenticated
  using (public.is_career_admin());

-- 4. Storage bucket -----------------------------------------------------
-- PRIVATE bucket: images are served through short-lived signed URLs, and
-- only for photos that are published (or to admins). 5 MB limit, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('career-fair-ar', 'career-fair-ar', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 5. Storage policies ---------------------------------------------------
drop policy if exists "ar read published files" on storage.objects;
create policy "ar read published files" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'career-fair-ar'
    and exists (
      select 1 from public.ar_photos p
      where p.storage_path = storage.objects.name and p.is_published = true
    )
  );

drop policy if exists "ar admin read files" on storage.objects;
create policy "ar admin read files" on storage.objects
  for select to authenticated
  using (bucket_id = 'career-fair-ar' and public.is_career_admin());

drop policy if exists "ar admin insert files" on storage.objects;
create policy "ar admin insert files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'career-fair-ar' and public.is_career_admin());

drop policy if exists "ar admin update files" on storage.objects;
create policy "ar admin update files" on storage.objects
  for update to authenticated
  using (bucket_id = 'career-fair-ar' and public.is_career_admin())
  with check (bucket_id = 'career-fair-ar' and public.is_career_admin());

drop policy if exists "ar admin delete files" on storage.objects;
create policy "ar admin delete files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'career-fair-ar' and public.is_career_admin());

-- 6. Make yourself an admin --------------------------------------------
-- AFTER creating the admin user in Authentication > Users, run:
--
--   insert into public.career_admins (user_id)
--   select id from auth.users where email = 'admin123@careerfair.local';
--
-- (use the email address of the Supabase Auth admin account)
