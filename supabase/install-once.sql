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
  email text,
  full_name text not null default '',
  avatar_url text,
  batch text not null default '',
  department text not null default '',
  session text not null default '',
  gender text not null default '',
  contact_number text not null default '',
  cgpa numeric(4, 2) check (cgpa is null or (cgpa >= 0 and cgpa <= 4)),
  role text not null default 'student'
    check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

create table public.course_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text not null,
  section text not null default 'A',
  seat_capacity integer not null default 30 check (seat_capacity >= 0 and seat_capacity <= 500),
  credits integer not null check (credits >= 1 and credits <= 12),
  instructor text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, section)
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

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    meta_role
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
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

create policy "profiles_update_admin"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if auth.uid() = old.id then
    if new.full_name is distinct from old.full_name
       or new.email is distinct from old.email
       or new.batch is distinct from old.batch
       or new.department is distinct from old.department
       or new.session is distinct from old.session
       or new.gender is distinct from old.gender
       or new.contact_number is distinct from old.contact_number
       or new.cgpa is distinct from old.cgpa
       or new.role is distinct from old.role then
      raise exception 'Only administrators can edit profile details';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

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

-- Seat counts for students (read-only remaining seats)
create or replace function public.catalog_seat_remaining()
returns table (course_id uuid, seats_remaining integer, seats_enrolled integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as course_id,
    greatest(
      0,
      c.seat_capacity - coalesce((
        select count(*)::int
        from public.enrollments e
        where e.course_id = c.id and e.status in ('enrolled', 'completed')
      ), 0)
    ) as seats_remaining,
    coalesce((
      select count(*)::int
      from public.enrollments e
      where e.course_id = c.id and e.status in ('enrolled', 'completed')
    ), 0) as seats_enrolled
  from public.course_catalog c;
$$;

grant execute on function public.catalog_seat_remaining() to authenticated;

create or replace function public.enforce_seat_capacity()
returns trigger
language plpgsql
as $$
declare
  cap integer;
  used integer;
begin
  select seat_capacity into cap from public.course_catalog where id = new.course_id;
  if cap is null then
    raise exception 'Course not found';
  end if;
  select count(*)::int into used
  from public.enrollments e
  where e.course_id = new.course_id and e.status in ('enrolled', 'completed');
  if used >= cap then
    raise exception 'No seats available';
  end if;
  return new;
end;
$$;

drop trigger if exists enrollments_check_seats on public.enrollments;
create trigger enrollments_check_seats
  before insert on public.enrollments
  for each row execute function public.enforce_seat_capacity();

-- Announcements / notices
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "announcements_select_auth"
  on public.announcements for select to authenticated using (true);

create policy "announcements_insert_admin"
  on public.announcements for insert to authenticated
  with check (public.is_admin());

create policy "announcements_update_admin"
  on public.announcements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "announcements_delete_admin"
  on public.announcements for delete to authenticated
  using (public.is_admin());

-- Avatar storage
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

create policy "avatars_public_read"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy "avatars_upload_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
