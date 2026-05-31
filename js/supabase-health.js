import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';

const CHECKS = [
  { key: 'course_catalog', path: '/rest/v1/course_catalog?select=id,section,seat_capacity&limit=1' },
  { key: 'profiles', path: '/rest/v1/profiles?select=id,batch,avatar_url,cgpa&limit=1' },
  { key: 'enrollments', path: '/rest/v1/enrollments?select=id&limit=1' },
  { key: 'announcements', path: '/rest/v1/announcements?select=id&limit=1' },
  { key: 'portal_settings', path: '/rest/v1/portal_settings?select=id&limit=1' },
];

function headers() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

async function probe(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers: headers(), ...options });
  const text = await res.text();
  return { ok: res.ok, text, status: res.status };
}

export async function checkSupabaseReady() {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'config', checks: {} };
  }

  const checks = {};
  try {
    for (const { key, path } of CHECKS) {
      const result = await probe(path);
      checks[key] = result.ok;
      if (!result.ok) {
        if (result.text.includes('PGRST205') || result.text.includes('does not exist')) {
          return { ok: false, message: 'missing_table', missing: key, checks };
        }
        if (result.text.includes('column') && result.text.includes('does not exist')) {
          return { ok: false, message: 'missing_column', missing: key, checks, detail: result.text };
        }
        return { ok: false, message: 'error', checks, detail: result.text };
      }
    }

    const rpc = await probe('/rest/v1/rpc/catalog_seat_remaining', {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: '{}',
    });
    checks.seat_rpc = rpc.ok;
    if (!rpc.ok) {
      return { ok: false, message: 'missing_rpc', checks, detail: rpc.text };
    }

    return { ok: true, checks };
  } catch {
    return { ok: false, message: 'network', checks: {} };
  }
}

export async function updateSetupBanner() {
  const banner = document.getElementById('config-banner');
  if (!banner || !isSupabaseConfigured()) return;

  const status = await checkSupabaseReady();
  if (status.ok) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;
  banner.classList.remove('config-banner--demo', 'config-banner--ok');
  banner.classList.add('config-banner--warn');

  if (status.message === 'missing_table' || status.message === 'missing_column' || status.message === 'missing_rpc') {
    banner.innerHTML =
      'Database upgrade needed — run <a href="setup.html">setup</a> and paste <code>supabase/upgrade-all.sql</code> in SQL Editor.';
  } else if (status.message === 'config') {
    banner.classList.remove('config-banner--warn');
    banner.classList.add('config-banner--demo');
    banner.innerHTML = 'Demo mode — edit <a href="js/config.js">js/config.js</a> for Supabase.';
  } else {
    banner.innerHTML = 'Supabase check failed. See <a href="setup.html">setup</a> or verify keys in <a href="js/config.js">js/config.js</a>.';
  }
}

export function formatSetupStatus(status) {
  if (status.ok) {
    return { html: '<span class="status-ok">✓ All ready — courses, profiles, notices, photos, and filters.</span>', ok: true };
  }
  if (status.message === 'missing_table') {
    return {
      html: `<span class="status-bad">✗ Missing table: <strong>${status.missing}</strong> — run upgrade SQL below.</span>`,
      ok: false,
    };
  }
  if (status.message === 'missing_column') {
    return {
      html: `<span class="status-bad">✗ Missing columns on <strong>${status.missing}</strong> — run <code>upgrade-all.sql</code>.</span>`,
      ok: false,
    };
  }
  if (status.message === 'missing_rpc') {
    return {
      html: '<span class="status-bad">✗ Seat function missing — run <code>upgrade-all.sql</code>.</span>',
      ok: false,
    };
  }
  return { html: '<span class="status-bad">✗ Could not connect. Check network and config.js.</span>', ok: false };
}
