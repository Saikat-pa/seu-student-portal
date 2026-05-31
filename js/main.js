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
  syncPortalNavLinks();

  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('is-open');
      const expanded = nav.classList.contains('is-open');
      toggle.setAttribute('aria-expanded', String(expanded));
    });
  }

  markActiveNavLink();
}

function markActiveNavLink() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link[data-page]').forEach((link) => {
    link.classList.toggle('nav-link--active', link.dataset.page === path);
  });
}

function insertNavLink(nav, authSlot, href, label, page, afterSelector) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.className = 'nav-link';
  anchor.dataset.page = page;
  anchor.textContent = label;
  const after = afterSelector ? nav.querySelector(afterSelector) : null;
  if (after) {
    after.insertAdjacentElement('afterend', anchor);
  } else {
    nav.insertBefore(anchor, authSlot);
  }
  return anchor;
}

function syncPortalNavLinks() {
  getSession().then(async ({ session }) => {
    const nav = document.getElementById('main-nav');
    const authSlot = document.getElementById('nav-auth');
    if (!nav || !authSlot) return;

    const signedIn = Boolean(session?.user);
    let isAdmin = false;
    if (signedIn) {
      const profile = await getUserProfile();
      isAdmin = isAdminRole(profile?.role);
    }

    const studentsLink = nav.querySelector('[data-page="students.html"]');
    if (isAdmin) {
      if (!studentsLink) {
        insertNavLink(nav, authSlot, 'students.html', 'Students', 'students.html', '[data-page="courses.html"]');
      }
    } else if (studentsLink) {
      studentsLink.remove();
    }

    const hasProfile = nav.querySelector('[data-page="profile.html"]');
    if (signedIn && !hasProfile) {
      if (!nav.querySelector('[data-page="notices.html"]')) {
        insertNavLink(nav, authSlot, 'notices.html', 'Notices', 'notices.html');
      }
      if (!nav.querySelector('[data-page="profile.html"]')) {
        insertNavLink(nav, authSlot, 'profile.html', 'Profile', 'profile.html');
      }
    }

    markActiveNavLink();
  });
}
