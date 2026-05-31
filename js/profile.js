import { requireAuth, getUserProfile } from './auth.js';
import { isAdminRole } from './roles.js';
import { uploadAvatar, updateProfile } from './api.js';
import {
  avatarInitials,
  formatCgpa,
  mapProfileRow,
  validateAvatarFile,
} from './profile-utils.js';
import { escapeHtml, showToast } from './utils.js';

const FIELD_LABELS = [
  ['fullName', 'Name'],
  ['email', 'Email'],
  ['batch', 'Batch'],
  ['department', 'Department'],
  ['session', 'Session'],
  ['gender', 'Gender'],
  ['contactNumber', 'Contact number'],
  ['cgpa', 'CGPA'],
  ['role', 'Role'],
];

function renderAvatar(profile) {
  const wrap = document.getElementById('profile-avatar-wrap');
  if (!wrap) return;
  if (profile.avatarUrl) {
    wrap.innerHTML = `<img class="avatar avatar--xl" src="${escapeHtml(profile.avatarUrl)}" alt="Profile photo" />`;
  } else {
    wrap.innerHTML = `<div class="avatar avatar--xl avatar--placeholder">${escapeHtml(avatarInitials(profile.fullName))}</div>`;
  }
  const removeBtn = document.getElementById('avatar-remove');
  if (removeBtn) removeBtn.hidden = !profile.avatarUrl;
}

function renderFields(profile) {
  const dl = document.getElementById('profile-fields');
  if (!dl) return;
  dl.innerHTML = FIELD_LABELS.map(([key, label]) => {
    let value = profile[key];
    if (key === 'cgpa') value = formatCgpa(profile.cgpa);
    if (key === 'role') value = isAdminRole(profile.role) ? 'Administrator' : 'Student';
    if (value === '' || value == null) value = '—';
    return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd>`;
  }).join('');
}

function bindPhotoUpload(userId, reload) {
  const input = document.getElementById('avatar-input');
  const removeBtn = document.getElementById('avatar-remove');
  if (!input) return;

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const err = validateAvatarFile(file);
    if (err) {
      showToast(err, 'error');
      return;
    }
    const { url, error } = await uploadAvatar(userId, file);
    if (error) {
      showToast(error.message || 'Upload failed.', 'error');
      return;
    }
    showToast('Photo updated.', 'success');
    await reload();
  });

  removeBtn?.addEventListener('click', async () => {
    const { error } = await updateProfile(userId, { avatar_url: '' });
    if (error) {
      showToast(error.message || 'Could not remove photo.', 'error');
      return;
    }
    showToast('Photo removed.', 'success');
    await reload();
  });
}

export async function initProfilePage() {
  const session = await requireAuth();
  if (!session) return;

  async function reload() {
    const profile = await getUserProfile();
    if (!profile) return;
    renderAvatar(profile);
    renderFields(profile);
    return profile;
  }

  let profile = await reload();
  if (!profile) return;

  const isAdmin = isAdminRole(profile.role);
  const heading = document.getElementById('profile-heading');
  const sub = document.getElementById('profile-sub');
  const adminNote = document.getElementById('profile-admin-note');
  const studentsLink = document.getElementById('profile-students-link');

  if (isAdmin) {
    if (heading) heading.textContent = 'My profile (Admin)';
    if (sub) sub.textContent = 'Upload your photo. Edit student records on the Students page.';
    if (adminNote) adminNote.hidden = false;
    if (studentsLink) studentsLink.hidden = false;
  } else if (sub) {
    sub.textContent =
      'Your academic details are managed by the administrator. You can view them here and update your photo only.';
  }

  bindPhotoUpload(session.user.id, reload);
}

export { mapProfileRow, renderAvatar, renderFields };
