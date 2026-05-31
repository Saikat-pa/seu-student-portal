-- Run in Supabase SQL Editor if course_catalog has no seat_capacity column

alter table public.course_catalog
  add column if not exists seat_capacity integer not null default 30;

alter table public.course_catalog drop constraint if exists course_catalog_seat_capacity_check;
alter table public.course_catalog
  add constraint course_catalog_seat_capacity_check
  check (seat_capacity >= 0 and seat_capacity <= 500);

-- Functions and trigger (same as install-once.sql)
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
