-- Run in Supabase SQL Editor if course_catalog already exists without section

alter table public.course_catalog
  add column if not exists section text not null default 'A';

alter table public.course_catalog drop constraint if exists course_catalog_code_key;

create unique index if not exists course_catalog_code_section_uidx
  on public.course_catalog (code, section);
