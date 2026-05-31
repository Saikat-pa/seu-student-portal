-- Profile fields + avatar storage (run after section/seats migrations)

alter table public.profiles
  add column if not exists email text,
  add column if not exists avatar_url text,
  add column if not exists batch text not null default '',
  add column if not exists department text not null default '',
  add column if not exists session text not null default '',
  add column if not exists gender text not null default '',
  add column if not exists contact_number text not null default '',
  add column if not exists cgpa numeric(4, 2) check (cgpa is null or (cgpa >= 0 and cgpa <= 4));

-- Sync email from auth for existing users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

-- Admin can update any profile
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Students may only change avatar_url on their own row
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

-- Avatar storage bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_upload_own" on storage.objects;
create policy "avatars_upload_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
