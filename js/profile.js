import { requireAuth, getUserProfile } from './auth.js';
import { isAdminRole } from './roles.js';
import { updateProfile } from './api.js';
import { showToast, setFieldError, clearFieldError } from './utils.js';

export async function initProfilePage() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await getUserProfile();
  const emailEl = document.getElementById('profile-email');
  const roleEl = document.getElementById('profile-role');
  const idEl = document.getElementById('profile-id');
  const nameInput = document.getElementById('profile-name');
  const form = document.getElementById('profile-form');

  if (emailEl) emailEl.textContent = profile?.email || session.user.email || '—';
  if (idEl) idEl.textContent = session.user.id;
  if (roleEl && profile) {
    roleEl.textContent = isAdminRole(profile.role) ? 'Administrator' : 'Student';
    roleEl.className = `badge badge--${isAdminRole(profile.role) ? 'completed' : 'active'}`;
  }
  if (nameInput && profile) nameInput.value = profile.fullName || '';

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldError(nameInput);
    const full_name = nameInput.value.trim();
    if (full_name.length < 2) {
      setFieldError(nameInput, 'Enter at least 2 characters.');
      return;
    }
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    const { error } = await updateProfile(session.user.id, { full_name });
    btn.disabled = false;
    if (error) {
      showToast(error.message || 'Could not save profile.', 'error');
      return;
    }
    showToast('Profile updated.', 'success');
  });
}
