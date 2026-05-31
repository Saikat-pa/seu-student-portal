-- One active enrollment per course code per student (any section)
create or replace function public.enforce_one_course_code_per_student()
returns trigger
language plpgsql
as $$
declare
  new_code text;
  conflict_exists boolean;
begin
  if new.status not in ('enrolled', 'completed') then
    return new;
  end if;

  select upper(code) into new_code
  from public.course_catalog
  where id = new.course_id;

  if new_code is null then
    raise exception 'Course not found';
  end if;

  select exists (
    select 1
    from public.enrollments e
    join public.course_catalog c on c.id = e.course_id
    where e.user_id = new.user_id
      and e.status in ('enrolled', 'completed')
      and upper(c.code) = new_code
      and e.id is distinct from new.id
  ) into conflict_exists;

  if conflict_exists then
    raise exception 'You already selected this course code in another section';
  end if;

  return new;
end;
$$;

drop trigger if exists enrollments_one_code_per_student on public.enrollments;
create trigger enrollments_one_code_per_student
  before insert or update on public.enrollments
  for each row execute function public.enforce_one_course_code_per_student();
