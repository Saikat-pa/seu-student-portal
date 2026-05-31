import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const cfg = readFileSync(join(dir, '../js/config.js'), 'utf8');
const SUPABASE_URL = cfg.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1];
const SUPABASE_ANON_KEY = cfg.match(/SUPABASE_ANON_KEY\s*=\s*\n?\s*'([^']+)'/)?.[1]
  || cfg.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Could not read Supabase credentials from js/config.js');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

console.log('Checking Supabase…');
console.log('URL:', SUPABASE_URL);

const authRes = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers });
console.log('Auth API:', authRes.status, authRes.status === 200 ? 'OK' : 'FAIL');

const tables = ['profiles', 'course_catalog', 'enrollments'];
let allOk = true;

for (const table of tables) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, { headers });
  const body = await res.text();
  const ok = res.ok;
  console.log(`${table}:`, res.status, ok ? 'OK' : body.slice(0, 120));
  if (!ok) allOk = false;
}

if (!allOk) {
  console.log('\n→ Run supabase/install-once.sql in Supabase SQL Editor.');
  process.exit(1);
}

console.log('\n✓ Supabase is ready.');
console.log('  npm start  →  http://localhost:3000/login.html');
