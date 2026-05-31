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

async function probe(label, url, options = {}) {
  const res = await fetch(url, { headers, ...options });
  const text = await res.text();
  const ok = res.ok;
  console.log(`${label}:`, res.status, ok ? 'OK' : text.slice(0, 100));
  return ok;
}

console.log('Checking Supabase…');
console.log('URL:', SUPABASE_URL);

const authOk = await probe('Auth API', `${SUPABASE_URL}/auth/v1/health`);
let allOk = authOk;

allOk = (await probe('profiles (extended)', `${SUPABASE_URL}/rest/v1/profiles?select=id,batch,avatar_url,cgpa&limit=1`)) && allOk;
allOk = (await probe('course_catalog (section+seats)', `${SUPABASE_URL}/rest/v1/course_catalog?select=id,section,seat_capacity&limit=1`)) && allOk;
allOk = (await probe('enrollments', `${SUPABASE_URL}/rest/v1/enrollments?select=id&limit=1`)) && allOk;
allOk = (await probe('announcements', `${SUPABASE_URL}/rest/v1/announcements?select=id&limit=1`)) && allOk;
allOk = (await probe('seat RPC', `${SUPABASE_URL}/rest/v1/rpc/catalog_seat_remaining`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: '{}',
})) && allOk;

if (!allOk) {
  console.log('\n→ Run supabase/upgrade-all.sql in Supabase SQL Editor (or install-once.sql if fresh).');
  process.exit(1);
}

console.log('\n✓ Supabase fully ready.');
console.log('  Live: https://saikat-pa.github.io/seu-student-portal/');
console.log('  Local: npm start → http://localhost:3000/login.html');
