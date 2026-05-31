-- Credit limits table (admin min/max credits per student)
-- Safe to re-run. Run in Supabase SQL Editor if "Save limits" shows schema cache error.

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

-- Refresh API schema cache so the app sees the new table immediately
notify pgrst, 'reload schema';

select 'portal_settings ready' as status;
