-- ═══════════════════════════════════════════════════════════════
-- Student Portal — ONE FILE: paste in Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- Remove old tables (safe if they never existed)
drop table if exists public.courses cascade;
drop table if exists public.enrollments cascade;
drop table if exists public.course_catalog cascade;
drop table if exists public.profiles cascade;

-- ─── New schema (admin catalog + student enrollments) ───

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student'
    check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

create table public.course_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text not null unique,
  credits integer not null check (credits >= 1 and credits <= 12),
  instructor text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.course_catalog (id) on delete cascade,
  status text not null default 'enrolled'
    check (status in ('enrolled', 'completed', 'dropped')),
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index enrollments_user_id_idx on public.enrollments (user_id);
create index enrollments_course_id_idx on public.enrollments (course_id);

alter table public.profiles enable row level security;
alter table public.course_catalog enable row level security;
alter table public.enrollments enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
begin
  if meta_role not in ('admin', 'student') then
    meta_role := 'student';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    meta_role
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- profiles
create policy "profiles_select_own"
  on public.profiles for select using (auth.uid() = id);

create policy "profiles_select_admin"
  on public.profiles for select using (public.is_admin());

create policy "profiles_insert_own"
  on public.profiles for insert with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = id);

-- course catalog
create policy "catalog_select_auth"
  on public.course_catalog for select to authenticated using (true);

create policy "catalog_insert_admin"
  on public.course_catalog for insert to authenticated
  with check (public.is_admin());

create policy "catalog_update_admin"
  on public.course_catalog for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "catalog_delete_admin"
  on public.course_catalog for delete to authenticated
  using (public.is_admin());

-- enrollments
create policy "enrollments_select_own"
  on public.enrollments for select using (auth.uid() = user_id);

create policy "enrollments_select_admin"
  on public.enrollments for select using (public.is_admin());

create policy "enrollments_insert_own"
  on public.enrollments for insert
  with check (
    auth.uid() = user_id
    and not public.is_admin()
    and exists (
      select 1 from public.course_catalog c
      where c.id = course_id and c.is_active = true
    )
  );

create policy "enrollments_update_own"
  on public.enrollments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "enrollments_delete_own"
  on public.enrollments for delete using (auth.uid() = user_id);

create trigger course_catalog_updated_at
  before update on public.course_catalog
  for each row execute function public.set_updated_at();
