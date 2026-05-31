import { updateLogos } from './branding.js';

const STORAGE_KEY = 'portal-theme';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function setTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  syncToggleButton();
  updateLogos(next);
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function syncToggleButton() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const dark = getTheme() === 'dark';
  btn.textContent = dark ? '☀️' : '🌙';
  btn.title = dark ? 'Light mode' : 'Dark mode';
  btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  btn.classList.toggle('theme-toggle--light-active', !dark);
}

export function initThemeToggle() {
  let btn = document.getElementById('theme-toggle');
  const nav = document.getElementById('main-nav');

  if (!btn && nav) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'theme-toggle';
    btn.className = 'theme-toggle';
    const auth = document.getElementById('nav-auth');
    nav.insertBefore(btn, auth || null);
  }

  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', toggleTheme);
  }

  syncToggleButton();
  updateLogos(getTheme());
}
