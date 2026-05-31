import { requireAuth, getUserProfile } from './auth.js';
import { isAdminRole } from './roles.js';
import {
  fetchCatalog,
  insertCatalog,
  updateCatalog,
  deleteCatalog,
  fetchEnrollments,
  enrollInCourse,
  dropEnrollment,
  updateEnrollmentStatus,
} from './api.js';
import {
  showToast,
  validateCatalogForm,
  setFieldError,
  clearFieldError,
  escapeHtml,
  formatDate,
} from './utils.js';

let editingCatalogId = null;
let catalogCache = [];
let enrollmentsCache = [];
let currentUserId = null;
let isAdmin = false;

function mapError(error) {
  if (!error) return null;
  return typeof error === 'string' ? error : error.message;
}

function getCatalogFields(form) {
  return {
    title: form.title,
    code: form.code,
    credits: form.credits,
    instructor: form.instructor,
    is_active: form.is_active,
  };
}

function applyValidationErrors(form, errors) {
  const fields = getCatalogFields(form);
  Object.values(fields).forEach(clearFieldError);
  Object.entries(errors).forEach(([key, msg]) => {
    if (fields[key]) setFieldError(fields[key], msg);
  });
}

/* ——— Admin: catalog CRUD ——— */

async function loadAdminCatalog() {
  const { data, error } = await fetchCatalog();
  if (error) {
    showToast(mapError(error), 'error');
    return;
  }
  catalogCache = data || [];
  renderAdminTable();
  const el = document.getElementById('course-count');
  if (el) el.textContent = String(catalogCache.length);
}

function renderAdminTable() {
  const tbody = document.getElementById('admin-catalog-tbody');
  const empty = document.getElementById('admin-catalog-empty');
  if (!tbody) return;

  if (!catalogCache.length) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  tbody.innerHTML = catalogCache
    .map(
      (c) => `
    <tr>
      <td><strong>${escapeHtml(c.code)}</strong></td>
      <td>${escapeHtml(c.title)}</td>
      <td>${c.credits}</td>
      <td>${escapeHtml(c.instructor)}</td>
      <td><span class="badge badge--${c.is_active ? 'active' : 'dropped'}">${c.is_active ? 'Open' : 'Closed'}</span></td>
      <td>${formatDate(c.created_at)}</td>
      <td class="table-actions">
        <button type="button" class="btn btn--ghost btn--sm btn-edit-catalog" data-id="${c.id}">Edit</button>
        <button type="button" class="btn btn--danger btn--sm btn-delete-catalog" data-id="${c.id}">Delete</button>
      </td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('.btn-edit-catalog').forEach((btn) => {
    btn.addEventListener('click', () => startEditCatalog(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-delete-catalog').forEach((btn) => {
    btn.addEventListener('click', () => confirmDeleteCatalog(btn.dataset.id));
  });
}

function resetCatalogForm(form) {
  form.reset();
  if (form.is_active) form.is_active.checked = true;
  editingCatalogId = null;
  document.getElementById('form-heading').textContent = 'Add course to catalog';
  form.querySelector('[type="submit"]').textContent = 'Add course';
  document.getElementById('btn-cancel-edit')?.setAttribute('hidden', '');
  Object.values(getCatalogFields(form)).forEach(clearFieldError);
}

function startEditCatalog(id) {
  const course = catalogCache.find((c) => c.id === id);
  if (!course) return;
  const form = document.getElementById('admin-course-form');
  editingCatalogId = id;
  form.title.value = course.title;
  form.code.value = course.code;
  form.credits.value = course.credits;
  form.instructor.value = course.instructor;
  form.is_active.checked = !!course.is_active;
  document.getElementById('form-heading').textContent = 'Edit course';
  form.querySelector('[type="submit"]').textContent = 'Save changes';
  document.getElementById('btn-cancel-edit')?.removeAttribute('hidden');
}

async function confirmDeleteCatalog(id) {
  const course = catalogCache.find((c) => c.id === id);
  if (!course) return;
  if (!window.confirm(`Delete "${course.code}" from catalog? Enrollments will also be removed.`)) return;

  const { error } = await deleteCatalog(id);
  if (error) {
    showToast(mapError(error), 'error');
    return;
  }
  showToast('Course removed from catalog.', 'success');
  if (editingCatalogId === id) resetCatalogForm(document.getElementById('admin-course-form'));
  await loadAdminCatalog();
}

function bindAdminForm() {
  const form = document.getElementById('admin-course-form');
  if (!form) return;

  document.getElementById('btn-cancel-edit')?.addEventListener('click', () => resetCatalogForm(form));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = {
      title: form.title.value,
      code: form.code.value,
      credits: form.credits.value,
      instructor: form.instructor.value,
      is_active: form.is_active.checked,
    };
    const { errors, values } = validateCatalogForm(raw);
    if (Object.keys(errors).length) {
      applyValidationErrors(form, errors);
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;

    let error;
    if (editingCatalogId) {
      ({ error } = await updateCatalog(editingCatalogId, values));
    } else {
      ({ error } = await insertCatalog(values));
    }

    btn.disabled = false;
    if (error) {
      showToast(mapError(error), 'error');
      return;
    }

    showToast(editingCatalogId ? 'Course updated.' : 'Course added to catalog.', 'success');
    resetCatalogForm(form);
    await loadAdminCatalog();
  });
}

/* ——— Student: enroll / select ——— */

async function loadStudentViews() {
  const [catalogRes, enrollRes] = await Promise.all([
    fetchCatalog(),
    fetchEnrollments(currentUserId),
  ]);

  if (catalogRes.error) showToast(mapError(catalogRes.error), 'error');
  if (enrollRes.error) showToast(mapError(enrollRes.error), 'error');

  catalogCache = catalogRes.data || [];
  enrollmentsCache = enrollRes.data || [];

  renderAvailableCourses();
  renderMyEnrollments();

  const el = document.getElementById('course-count');
  if (el) el.textContent = String(enrollmentsCache.length);
}

function enrolledCourseIds() {
  return new Set(enrollmentsCache.map((e) => e.course_id));
}

function renderAvailableCourses() {
  const tbody = document.getElementById('available-courses-tbody');
  const empty = document.getElementById('available-empty');
  if (!tbody) return;

  const available = catalogCache.filter((c) => c.is_active);
  if (!available.length) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const enrolled = enrolledCourseIds();

  tbody.innerHTML = available
    .map((c) => {
      const taken = enrolled.has(c.id);
      return `
    <tr>
      <td><strong>${escapeHtml(c.code)}</strong></td>
      <td>${escapeHtml(c.title)}</td>
      <td>${c.credits}</td>
      <td>${escapeHtml(c.instructor)}</td>
      <td>
        ${
          taken
            ? '<span class="badge badge--completed">Enrolled</span>'
            : `<button type="button" class="btn btn--primary btn--sm btn-enroll" data-id="${c.id}">Select</button>`
        }
      </td>
    </tr>
  `;
    })
    .join('');

  tbody.querySelectorAll('.btn-enroll').forEach((btn) => {
    btn.addEventListener('click', () => handleEnroll(btn.dataset.id));
  });
}

function renderMyEnrollments() {
  const tbody = document.getElementById('enrollments-tbody');
  const empty = document.getElementById('enrollments-empty');
  if (!tbody) return;

  if (!enrollmentsCache.length) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  tbody.innerHTML = enrollmentsCache
    .map((e) => {
      const c = e.course_catalog || {};
      return `
    <tr>
      <td><strong>${escapeHtml(c.code || '—')}</strong></td>
      <td>${escapeHtml(c.title || '—')}</td>
      <td>${c.credits ?? '—'}</td>
      <td>
        <select class="enrollment-status" data-id="${e.id}" aria-label="Status for ${escapeHtml(c.code || 'course')}">
          <option value="enrolled" ${e.status === 'enrolled' ? 'selected' : ''}>Enrolled</option>
          <option value="completed" ${e.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="dropped" ${e.status === 'dropped' ? 'selected' : ''}>Dropped</option>
        </select>
      </td>
      <td class="table-actions">
        <button type="button" class="btn btn--danger btn--sm btn-drop" data-id="${e.id}">Drop</button>
      </td>
    </tr>
  `;
    })
    .join('');

  tbody.querySelectorAll('.btn-drop').forEach((btn) => {
    btn.addEventListener('click', () => handleDrop(btn.dataset.id));
  });

  tbody.querySelectorAll('.enrollment-status').forEach((sel) => {
    sel.addEventListener('change', () => handleStatusChange(sel.dataset.id, sel.value));
  });
}

async function handleEnroll(courseId) {
  const { error } = await enrollInCourse(currentUserId, courseId);
  if (error) {
    showToast(mapError(error), 'error');
    return;
  }
  showToast('Course selected.', 'success');
  await loadStudentViews();
}

async function handleDrop(enrollmentId) {
  const row = enrollmentsCache.find((e) => e.id === enrollmentId);
  const c = row?.course_catalog;
  if (!window.confirm(`Drop ${c?.code || 'this course'}?`)) return;

  const { error } = await dropEnrollment(currentUserId, enrollmentId);
  if (error) {
    showToast(mapError(error), 'error');
    return;
  }
  showToast('Course dropped.', 'success');
  await loadStudentViews();
}

async function handleStatusChange(enrollmentId, status) {
  const { error } = await updateEnrollmentStatus(currentUserId, enrollmentId, status);
  if (error) {
    showToast(mapError(error), 'error');
    return;
  }
  showToast('Status updated.', 'success');
  await loadStudentViews();
}

export async function initCoursesPage() {
  const session = await requireAuth();
  if (!session) return;

  currentUserId = session.user.id;
  const profile = await getUserProfile();
  isAdmin = isAdminRole(profile?.role);

  const welcome = document.getElementById('page-user');
  const roleBadge = document.getElementById('role-badge');
  const pageTitle = document.getElementById('page-title');
  const pageDesc = document.getElementById('page-desc');

  if (welcome && profile) welcome.textContent = profile.fullName;
  if (roleBadge) {
    roleBadge.textContent = isAdmin ? 'Admin' : 'Student';
    roleBadge.className = `badge badge--${isAdmin ? 'completed' : 'active'}`;
  }

  document.getElementById('admin-panel').hidden = !isAdmin;
  document.getElementById('student-panel').hidden = isAdmin;

  if (isAdmin) {
    if (pageTitle) pageTitle.textContent = 'Manage course catalog';
    if (pageDesc) pageDesc.textContent = 'Add and edit courses students can select.';
    bindAdminForm();
    await loadAdminCatalog();
  } else {
    if (pageTitle) pageTitle.textContent = 'My courses';
    if (pageDesc) pageDesc.textContent = 'Select courses from the catalog — you cannot create new courses.';
    await loadStudentViews();
  }
}
