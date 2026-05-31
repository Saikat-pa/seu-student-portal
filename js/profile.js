import { requireAuth, getUserProfile } from './auth.js';
import { isAdminRole } from './roles.js';
import { uploadAvatar, updateProfile } from './api.js';
import { openAvatarCrop, initAvatarCrop } from './avatar-crop.js';
import {
  avatarInitials,
  mapProfileRow,
  validateAvatarFile,
  validateProfilePatch,
} from './profile-utils.js';
import { escapeHtml, showToast, setFieldError, clearFieldError } from './utils.js';

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

function fillProfileForm(profile) {
  const form = document.getElementById('profile-form');
  if (!form) return;
  form.full_name.value = profile.fullName || '';
  form.email.value = profile.email || '';
  form.batch.value = profile.batch || '';
  form.department.value = profile.department || '';
  form.session.value = profile.session || '';
  form.gender.value = profile.gender || '';
  form.contact_number.value = profile.contactNumber || '';
  form.cgpa.value = profile.cgpa != null ? profile.cgpa : '';

  const roleEl = document.getElementById('profile-role-display');
  if (roleEl) {
    roleEl.textContent = isAdminRole(profile.role) ? 'Administrator' : 'Student';
  }
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

    let cropped;
    try {
      cropped = await openAvatarCrop(file);
    } catch (e) {
      if (e?.message !== 'cancelled') showToast(e?.message || 'Could not crop photo.', 'error');
      return;
    }

    const { error } = await uploadAvatar(userId, cropped);
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

function bindProfileForm(userId, reload) {
  const form = document.getElementById('profile-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patch = {
      full_name: form.full_name.value,
      email: form.email.value,
      batch: form.batch.value,
      department: form.department.value,
      session: form.session.value,
      gender: form.gender.value,
      contact_number: form.contact_number.value,
      cgpa: form.cgpa.value,
    };

    form.querySelectorAll('input, select').forEach(clearFieldError);
    const errors = validateProfilePatch(patch);
    if (errors.full_name) setFieldError(form.full_name, errors.full_name);
    if (errors.email) setFieldError(form.email, errors.email);
    if (errors.cgpa) setFieldError(form.cgpa, errors.cgpa);
    if (Object.keys(errors).length) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    const { error } = await updateProfile(userId, patch);
    btn.disabled = false;
    if (error) {
      showToast(error.message || 'Save failed.', 'error');
      return;
    }
    showToast('Profile saved.', 'success');
    await reload();
  });
}

export async function initProfilePage() {
  const session = await requireAuth();
  if (!session) return;

  initAvatarCrop();

  async function reload() {
    const profile = await getUserProfile();
    if (!profile) return;
    renderAvatar(profile);
    fillProfileForm(profile);
    return profile;
  }

  const profile = await reload();
  if (!profile) return;

  const isAdmin = isAdminRole(profile.role);
  const heading = document.getElementById('profile-heading');
  const sub = document.getElementById('profile-sub');
  const adminNote = document.getElementById('profile-admin-note');

  if (isAdmin) {
    if (heading) heading.textContent = 'My profile (Admin)';
    if (sub) sub.textContent = 'Edit your details and photo below. Manage other students from the Students page.';
    if (adminNote) adminNote.hidden = false;
  } else {
    if (sub) {
      sub.textContent = 'Update your name, contact, academic details, and profile photo below.';
    }
    if (adminNote) adminNote.hidden = true;
  }

  bindPhotoUpload(session.user.id, reload);
  bindProfileForm(session.user.id, reload);
}

export { mapProfileRow, renderAvatar };
