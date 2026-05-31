import {
  getSession,
  signInWithPassword,
  signUp,
  signOut as apiSignOut,
  useLocalMode,
  fetchProfile,
  ensureProfileForUser,
} from './api.js';
import { showToast, validateEmail, validatePassword, setFieldError, clearFieldError } from './utils.js';
import { normalizeAuthError } from './errors.js';
import { isAdminRole } from './roles.js';
import { mapProfileRow } from './profile-utils.js';
import { appUrl } from './app-url.js';

export { getSupabase } from './api.js';
export { getSession, useLocalMode };

export async function requireAuth(redirectTo = 'login.html') {
  const { session, error } = await getSession();
  if (error && !useLocalMode()) {
    showToast(error, 'error');
  }
  if (!session) {
    const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'dashboard.html');
    window.location.href = `${redirectTo}?redirect=${next}`;
    return null;
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (!session) return null;
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    showToast('Admin access only.', 'error');
    window.location.href = 'courses.html';
    return null;
  }
  return session;
}

export async function redirectIfAuthenticated(target = 'dashboard.html') {
  const { session } = await getSession();
  if (session) {
    window.location.href = target;
  }
}

export function initNavAuth() {
  const navAuth = document.getElementById('nav-auth');
  if (!navAuth) return;

  if (!navAuth.dataset.authBound) {
    navAuth.dataset.authBound = '1';
    navAuth.addEventListener('click', (e) => {
      if (e.target.closest('#btn-logout')) {
        e.preventDefault();
        void signOut();
      }
    });
  }

  getSession().then(async ({ session }) => {
    const signedIn = Boolean(session?.user);
    document.documentElement.dataset.navAuth = signedIn ? 'in' : 'out';

    const coursesLink = document.querySelector('.nav-link[data-page="courses.html"]');

    if (signedIn) {
      const profile = await getUserProfile();
      const isAdmin = isAdminRole(profile?.role);
      if (coursesLink) {
        coursesLink.textContent = isAdmin ? 'Manage courses' : 'My courses';
      }
      navAuth.innerHTML = `
        <button type="button" class="btn btn--ghost btn--sm" id="btn-logout">Sign out</button>
      `;
    } else {
      if (coursesLink) coursesLink.textContent = 'Courses';
      navAuth.innerHTML = `<a href="login.html" class="btn btn--primary btn--sm">Sign in</a>`;
    }
  });
}

export async function signOut() {
  const btn = document.getElementById('btn-logout');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Signing out…';
  }
  try {
    await apiSignOut();
  } finally {
    window.location.replace(appUrl('index.html'));
  }
}

export function bindLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  redirectIfAuthenticated();

  const demoHint = document.getElementById('demo-hint');
  if (useLocalMode() && demoHint) {
    demoHint.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email;
    const password = form.password;

    [email, password].forEach(clearFieldError);

    const emailErr = validateEmail(email.value);
    const passErr = validatePassword(password.value);

    if (emailErr) setFieldError(email, emailErr);
    if (passErr) setFieldError(password, passErr);
    if (emailErr || passErr) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;

    const { error } = await signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    });

    btn.disabled = false;

    if (error) {
      showToast(normalizeAuthError(error) || error.message, 'error');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get('redirect') || 'dashboard.html';
  });
}

export function bindRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = form.fullName;
    const email = form.email;
    const password = form.password;
    const confirm = form.confirmPassword;

    [fullName, email, password, confirm].forEach(clearFieldError);

    let hasError = false;
    if (!fullName.value.trim() || fullName.value.trim().length < 2) {
      setFieldError(fullName, 'Enter your full name (at least 2 characters).');
      hasError = true;
    }

    const emailErr = validateEmail(email.value);
    if (emailErr) {
      setFieldError(email, emailErr);
      hasError = true;
    }

    const passErr = validatePassword(password.value);
    if (passErr) {
      setFieldError(password, passErr);
      hasError = true;
    }

    const confirmErr = validatePassword(confirm.value, { confirm: true, other: password.value });
    if (confirmErr) {
      setFieldError(confirm, confirmErr);
      hasError = true;
    }

    if (hasError) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;

    const { data, error } = await signUp({
      email: email.value.trim(),
      password: password.value,
      options: { data: { full_name: fullName.value.trim() } },
    });

    btn.disabled = false;

    if (error) {
      showToast(normalizeAuthError(error) || error.message, 'error');
      return;
    }

    if (data?.user && !data?.session && !useLocalMode()) {
      showToast('Check your email to confirm your account, then sign in.', 'success');
      document.querySelector('[data-tab="login"]')?.click();
      return;
    }

    showToast('Account created. Welcome!', 'success');
    window.location.href = 'dashboard.html';
  });
}

export function initAuthTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  const panels = document.querySelectorAll('[data-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('tabs__btn--active', t === tab));
      panels.forEach((p) => {
        p.hidden = p.dataset.panel !== name;
      });
    });
  });
}

export async function getUserProfile() {
  const { session } = await getSession();
  if (!session?.user) return null;

  await ensureProfileForUser(session.user);

  const { data: profile, error } = await fetchProfile(session.user.id);
  const meta = session.user.user_metadata || {};

  if (profile) {
    return mapProfileRow(profile, session.user.email);
  }

  if (!error) {
    return mapProfileRow(
      {
        id: session.user.id,
        full_name: meta.full_name || session.user.email?.split('@')[0] || 'User',
        role: meta.role || 'student',
        email: session.user.email,
      },
      session.user.email
    );
  }

  return mapProfileRow(
    {
      id: session.user.id,
      full_name: meta.full_name || 'User',
      role: meta.role || 'student',
      email: session.user.email,
    },
    session.user.email
  );
}
