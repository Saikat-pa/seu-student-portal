import { isSupabaseConfigured } from './config.js';
import { initNavAuth, useLocalMode } from './auth.js';
import { updateSetupBanner } from './supabase-health.js';
import { initThemeToggle } from './theme.js';
import { applyBranding } from './branding.js';

export function initLayout() {
  initThemeToggle();
  applyBranding();
  const banner = document.getElementById('config-banner');
  if (banner) {
    if (useLocalMode()) {
      banner.hidden = false;
      banner.classList.add('config-banner--demo');
      banner.innerHTML =
        'Demo mode — data is stored in your browser. Demo login: <strong>demo@student.local</strong> / <strong>demo12345</strong>. For Supabase, edit <a href="js/config.js">js/config.js</a>.';
    } else {
      updateSetupBanner();
    }
  }

  initNavAuth();

  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('is-open');
      const expanded = nav.classList.contains('is-open');
      toggle.setAttribute('aria-expanded', String(expanded));
    });
  }

  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link[data-page]').forEach((link) => {
    if (link.dataset.page === path) {
      link.classList.add('nav-link--active');
    }
  });
}
