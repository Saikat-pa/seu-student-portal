import { ADMIN_EMAILS } from './config.js';

export function roleForEmail(email) {
  const normalized = email?.trim().toLowerCase() || '';
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(normalized) ? 'admin' : 'student';
}

export function isAdminRole(role) {
  return role === 'admin';
}
