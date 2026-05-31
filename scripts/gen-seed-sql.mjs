import { writeFileSync } from 'fs';
import { CSE_CURRICULUM } from '../js/cse-curriculum.js';

const esc = (s) => String(s).replace(/'/g, "''");
const rows = CSE_CURRICULUM.map(
  (c) =>
    `  ('${esc(c.title)}', '${c.code}', '1', 40, ${c.credits}, 'TBA', '${esc(c.course_type)}', '${esc(c.prerequisite || '')}', false)`
);

const sql = `-- CSE curriculum seed (section 1). Run after upgrade-all.sql. Safe to re-run.
insert into public.course_catalog (title, code, section, seat_capacity, credits, instructor, course_type, prerequisite, is_active)
values
${rows.join(',\n')}
on conflict (code, section) do nothing;
`;

writeFileSync('supabase/seed-cse-courses.sql', sql);
console.log('Wrote supabase/seed-cse-courses.sql');
