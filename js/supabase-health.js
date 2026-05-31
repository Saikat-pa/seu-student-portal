import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';

export async function checkSupabaseReady() {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'config' };
  }

  try {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/course_catalog?select=id&limit=1`, { headers });
    if (res.ok) return { ok: true };
    const text = await res.text();
    if (text.includes('PGRST205') || text.includes('does not exist')) {
      return { ok: false, message: 'missing_table' };
    }
    return { ok: false, message: 'error', detail: text };
  } catch {
    return { ok: false, message: 'network' };
  }
}

export async function updateSetupBanner() {
  const banner = document.getElementById('config-banner');
  if (!banner || !isSupabaseConfigured()) return;

  const status = await checkSupabaseReady();
  if (status.ok) {
    banner.hidden = false;
    banner.className = 'config-banner config-banner--ok';
    banner.innerHTML =
      '✓ <strong>Live Supabase</strong> — <a href="login.html">Register</a> with your real email, then sign in to use courses and dashboard.';
    return;
  }

  banner.hidden = false;
  banner.classList.remove('config-banner--demo', 'config-banner--ok');

  if (status.message === 'missing_table') {
    banner.classList.add('config-banner--warn');
    banner.innerHTML =
      'Supabase connected, but <strong>course_catalog</strong> table missing. Run <code>supabase/schema-migrate-roles.sql</code> then <code>schema.sql</code> in SQL Editor.';
  } else if (status.message === 'config') {
    banner.classList.add('config-banner--demo');
    banner.innerHTML =
      'Demo mode — edit <a href="js/config.js">js/config.js</a> for Supabase.';
  } else {
    banner.classList.add('config-banner--warn');
    banner.innerHTML = 'Supabase check failed. Verify keys in <a href="js/config.js">js/config.js</a>.';
  }
}
