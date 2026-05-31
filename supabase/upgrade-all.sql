-- ═══════════════════════════════════════════════════════════════
-- Student Portal — ONE FILE upgrade (safe to re-run)
-- Paste in Supabase SQL Editor → Run
-- Use this if you already ran install-once.sql earlier
-- ═══════════════════════════════════════════════════════════════

-- ─── Section on course_catalog ───
alter table public.course_catalog
  add column if not exists section text not null default 'A';

alter table public.course_catalog drop constraint if exists course_catalog_code_key;
drop index if exists public.course_catalog_code_section_uidx;
create unique index if not exists course_catalog_code_section_uidx
  on public.course_catalog (code, section);

-- ─── Seats ───
alter table public.course_catalog
  add column if not exists seat_capacity integer not null default 30;

alter table public.course_catalog drop constraint if exists course_catalog_seat_capacity_check;
alter table public.course_catalog
  add constraint course_catalog_seat_capacity_check
  check (seat_capacity >= 0 and seat_capacity <= 500);

create or replace function public.catalog_seat_remaining()
returns table (course_id uuid, seats_remaining integer, seats_enrolled integer)
language sql stable security definer set search_path = public
as $$
  select c.id,
    greatest(0, c.seat_capacity - coalesce((select count(*)::int from public.enrollments e where e.course_id = c.id and e.status in ('enrolled', 'completed')), 0)),
    coalesce((select count(*)::int from public.enrollments e where e.course_id = c.id and e.status in ('enrolled', 'completed')), 0)
  from public.course_catalog c;
$$;
grant execute on function public.catalog_seat_remaining() to authenticated;

create or replace function public.enforce_seat_capacity()
returns trigger language plpgsql as $$
declare cap integer; used integer;
begin
  select seat_capacity into cap from public.course_catalog where id = new.course_id;
  if cap is null then raise exception 'Course not found'; end if;
  select count(*)::int into used from public.enrollments e where e.course_id = new.course_id and e.status in ('enrolled', 'completed');
  if used >= cap then raise exception 'No seats available'; end if;
  return new;
end; $$;
drop trigger if exists enrollments_check_seats on public.enrollments;
create trigger enrollments_check_seats before insert on public.enrollments for each row execute function public.enforce_seat_capacity();

-- ─── One course code per student (any section) ───
create or replace function public.enforce_one_course_code_per_student()
returns trigger language plpgsql as $$
declare new_code text; conflict_exists boolean;
begin
  if new.status not in ('enrolled', 'completed') then return new; end if;
  select upper(code) into new_code from public.course_catalog where id = new.course_id;
  if new_code is null then raise exception 'Course not found'; end if;
  select exists (
    select 1 from public.enrollments e
    join public.course_catalog c on c.id = e.course_id
    where e.user_id = new.user_id and e.status in ('enrolled', 'completed')
      and upper(c.code) = new_code and e.id is distinct from new.id
  ) into conflict_exists;
  if conflict_exists then
    raise exception 'You already selected this course code in another section';
  end if;
  return new;
end; $$;
drop trigger if exists enrollments_one_code_per_student on public.enrollments;
create trigger enrollments_one_code_per_student
  before insert or update on public.enrollments
  for each row execute function public.enforce_one_course_code_per_student();

-- ─── Announcements ───
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "announcements_select_auth" on public.announcements;
create policy "announcements_select_auth" on public.announcements for select to authenticated using (true);
drop policy if exists "announcements_insert_admin" on public.announcements;
create policy "announcements_insert_admin" on public.announcements for insert to authenticated with check (public.is_admin());
drop policy if exists "announcements_update_admin" on public.announcements;
create policy "announcements_update_admin" on public.announcements for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "announcements_delete_admin" on public.announcements;
create policy "announcements_delete_admin" on public.announcements for delete to authenticated using (public.is_admin());

-- ─── Profile fields + avatars ───
alter table public.profiles
  add column if not exists email text,
  add column if not exists avatar_url text,
  add column if not exists batch text not null default '',
  add column if not exists department text not null default '',
  add column if not exists session text not null default '',
  add column if not exists gender text not null default '',
  add column if not exists contact_number text not null default '',
  add column if not exists cgpa numeric(4, 2);

alter table public.profiles drop constraint if exists profiles_cgpa_check;
alter table public.profiles add constraint profiles_cgpa_check check (cgpa is null or (cgpa >= 0 and cgpa <= 4));

update public.profiles p set email = u.email from auth.users u where p.id = u.id and (p.email is null or p.email = '');

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if public.is_admin() then return new; end if;
  if auth.uid() = old.id then
    if new.full_name is distinct from old.full_name or new.email is distinct from old.email
       or new.batch is distinct from old.batch or new.department is distinct from old.department
       or new.session is distinct from old.session or new.gender is distinct from old.gender
       or new.contact_number is distinct from old.contact_number or new.cgpa is distinct from old.cgpa
       or new.role is distinct from old.role then
      raise exception 'Only administrators can edit profile details';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update before update on public.profiles for each row execute function public.guard_profile_update();

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do update set public = true;
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select to public using (bucket_id = 'avatars');
drop policy if exists "avatars_upload_own" on storage.objects;
create policy "avatars_upload_own" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Done
select 'Student Portal upgrade complete' as status;

-- ─── Course type + prerequisite ───
alter table public.course_catalog
  add column if not exists course_type text not null default '',
  add column if not exists prerequisite text not null default '';

-- ─── Enrollment credit limits (admin) ───
create table if not exists public.portal_settings (
  id smallint primary key default 1 check (id = 1),
  min_enrollment_credits integer not null default 0 check (min_enrollment_credits >= 0 and min_enrollment_credits <= 60),
  max_enrollment_credits integer not null default 21 check (max_enrollment_credits >= 1 and max_enrollment_credits <= 60),
  check (min_enrollment_credits <= max_enrollment_credits)
);
insert into public.portal_settings (id) values (1) on conflict (id) do nothing;
alter table public.portal_settings enable row level security;
drop policy if exists "portal_settings_select_auth" on public.portal_settings;
create policy "portal_settings_select_auth"
  on public.portal_settings for select to authenticated using (true);
drop policy if exists "portal_settings_update_admin" on public.portal_settings;
create policy "portal_settings_update_admin"
  on public.portal_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "portal_settings_insert_admin" on public.portal_settings;
create policy "portal_settings_insert_admin"
  on public.portal_settings for insert to authenticated
  with check (public.is_admin());
