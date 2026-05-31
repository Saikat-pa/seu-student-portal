import { isSupabaseConfigured } from './config.js';
import { getSession, initNavAuth, useLocalMode, getUserProfile } from './auth.js';
import { isAdminRole } from './roles.js';
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
  injectPortalNavLinks();

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

function injectPortalNavLinks() {
  getSession().then(async ({ session }) => {
    const nav = document.getElementById('main-nav');
    const authSlot = document.getElementById('nav-auth');
    if (!nav || !session || nav.querySelector('[data-page="profile.html"]')) return;

    let isAdmin = false;
    const profile = await getUserProfile();
    isAdmin = isAdminRole(profile?.role);

    const links = [
      ['notices.html', 'Notices', 'notices.html'],
      ['profile.html', 'Profile', 'profile.html'],
    ];
    if (isAdmin) links.unshift(['students.html', 'Students', 'students.html']);

    for (const [href, label, page] of links) {
      const link = document.createElement('a');
      link.href = href;
      link.className = 'nav-link';
      link.dataset.page = page;
      link.textContent = label;
      nav.insertBefore(link, authSlot);
    }

    const path = window.location.pathname.split('/').pop() || 'index.html';
    nav.querySelectorAll('.nav-link[data-page]').forEach((link) => {
      link.classList.toggle('nav-link--active', link.dataset.page === path);
    });
  });
}
