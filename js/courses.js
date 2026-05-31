import { requireAuth, getUserProfile } from './auth.js';
import { isAdminRole } from './roles.js';
import {
  fetchCatalog,
  fetchSeatRemainingMap,
  insertCatalog,
  updateCatalog,
  deleteCatalog,
  importCseCurriculum,
  openAllCatalogCourses,
  fetchEnrollmentLimits,
  updateEnrollmentLimits,
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
  formatCourseLabel,
} from './utils.js';
import {
  applyCatalogFilters,
  applyEnrollmentFilters,
  bindFilterForm,
  catalogFilterOptions,
  defaultCatalogFilters,
  defaultEnrollmentFilters,
  fillSelect,
  readCatalogFilters,
  readEnrollmentFilters,
  catalogFilterBarHtml,
  enrollmentFilterBarHtml,
} from './catalog-filters.js';
import {
  DEFAULT_ENROLLMENT_LIMITS,
  enrolledCredits,
  formatCreditLimitSummary,
  validateEnrollmentLimitsForm,
} from './enrollment-limits.js';

let editingCatalogId = null;
let catalogCache = [];
let enrollmentsCache = [];
let currentUserId = null;
let isAdmin = false;
let seatMap = {};
let catalogFilters = defaultCatalogFilters();
let enrollmentFilters = defaultEnrollmentFilters();
let adminPreviewMode = false;
let enrollmentLimits = { ...DEFAULT_ENROLLMENT_LIMITS };

function syncCoursePanels() {
  const adminPanel = document.getElementById('admin-panel');
  const studentPanel = document.getElementById('student-panel');
  const previewBar = document.getElementById('admin-preview-bar');
  if (!adminPanel || !studentPanel) return;

  if (isAdmin && adminPreviewMode) {
    adminPanel.hidden = true;
    studentPanel.hidden = false;
    if (previewBar) previewBar.hidden = false;
  } else if (isAdmin) {
    adminPanel.hidden = false;
    studentPanel.hidden = true;
    if (previewBar) previewBar.hidden = true;
  } else {
    adminPanel.hidden = true;
    studentPanel.hidden = false;
    if (previewBar) previewBar.hidden = true;
  }
}

function updatePageHeaderForMode() {
  const pageTitle = document.getElementById('page-title');
  const pageDesc = document.getElementById('page-desc');
  const roleBadge = document.getElementById('role-badge');

  if (!isAdmin) return;

  if (adminPreviewMode) {
    if (pageTitle) pageTitle.textContent = 'My courses';
    if (pageDesc) pageDesc.textContent =
      'Select courses from the catalog, then manage them under My selected courses.';
    if (roleBadge) {
      roleBadge.textContent = 'Student';
      roleBadge.className = 'badge badge--active';
    }
  } else {
    if (pageTitle) pageTitle.textContent = 'Course catalog (Admin)';
    if (pageDesc) pageDesc.textContent = 'Add courses below — students will see them in Available courses.';
    if (roleBadge) {
      roleBadge.textContent = 'Admin';
      roleBadge.className = 'badge badge--completed';
    }
  }
}

async function setAdminPreviewMode(on) {
  adminPreviewMode = on;
  syncCoursePanels();
  updatePageHeaderForMode();
  if (on) {
    await loadStudentViews();
  } else {
    await loadAdminCatalog();
  }
}

function updateFilterCount(root, shown, total) {
  const el = root?.querySelector('[data-filter-count]');
  if (el) el.textContent = total ? `Showing ${shown} of ${total}` : '';
}

function refreshCatalogFilterOptions(root) {
  if (!root) return;
  const opts = catalogFilterOptions(catalogCache);
  fillSelect(root.querySelector('[data-filter-field="section"]'), opts.sections, { allLabel: 'All sections' });
  fillSelect(root.querySelector('[data-filter-field="instructor"]'), opts.instructors, {
    allLabel: 'All instructors',
  });
  fillSelect(root.querySelector('[data-filter-field="credits"]'), opts.credits, { allLabel: 'All credits' });
  fillSelect(root.querySelector('[data-filter-field="courseType"]'), opts.courseTypes, {
    allLabel: 'All types',
  });
}

function setupAdminCatalogFilters() {
  const mount = document.getElementById('admin-catalog-filters');
  if (!mount || mount.dataset.ready) return;
  mount.innerHTML = catalogFilterBarHtml('admin');
  mount.dataset.ready = '1';
  const root = mount.querySelector('[data-filter-root]');
  refreshCatalogFilterOptions(root);
  bindFilterForm(root, readCatalogFilters, () => {
    catalogFilters = readCatalogFilters(root);
    renderAdminTable();
  });
}

function setupStudentAvailableFilters() {
  const mount = document.getElementById('student-available-filters');
  if (!mount || mount.dataset.ready) return;
  mount.innerHTML = catalogFilterBarHtml('avail');
  mount.dataset.ready = '1';
  const root = mount.querySelector('[data-filter-root]');
  refreshCatalogFilterOptions(root);
  bindFilterForm(root, readCatalogFilters, () => {
    catalogFilters = readCatalogFilters(root);
    renderAvailableCourses();
  });
}

function setupStudentEnrollmentFilters() {
  const mount = document.getElementById('student-enrollment-filters');
  if (!mount || mount.dataset.ready) return;
  mount.innerHTML = enrollmentFilterBarHtml('mine');
  mount.dataset.ready = '1';
  const root = mount.querySelector('[data-filter-root]');
  bindFilterForm(root, readEnrollmentFilters, () => {
    enrollmentFilters = readEnrollmentFilters(root);
    renderMyEnrollments();
  });
}

function mapError(error) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : error.message || '';
  if (/row-level security|permission denied|violates.*policy/i.test(msg)) {
    if (isAdmin) {
      return 'Admin permission denied. In Supabase SQL, set profiles.role = admin for your user.';
    }
    return 'Could not save. Sign in as a student, or ask an admin to add courses first.';
  }
  if (/duplicate key|unique constraint/i.test(msg)) {
    return 'This course code and section already exists.';
  }
  if (/no seats available/i.test(msg)) {
    return 'No seats left for this course.';
  }
  if (/already selected this course code/i.test(msg)) {
    return 'You already selected this course code in another section. Drop that course first.';
  }
  if (/maximum \d+ credits/i.test(msg) || /minimum \d+ credits/i.test(msg)) {
    return msg;
  }
  return msg;
}

function getCatalogFields(form) {
  return {
    title: form.title,
    code: form.code,
    section: form.section,
    seat_capacity: form.seat_capacity,
    credits: form.credits,
    instructor: form.instructor,
    course_type: form.course_type,
    prerequisite: form.prerequisite,
    is_active: form.is_active,
  };
}

function cellCourseType(c) {
  return c.course_type
    ? `<span class="badge badge--active">${escapeHtml(c.course_type)}</span>`
    : '—';
}

function cellPrerequisite(c) {
  return c.prerequisite ? escapeHtml(c.prerequisite) : '—';
}

function applyValidationErrors(form, errors) {
  const fields = getCatalogFields(form);
  Object.values(fields).forEach(clearFieldError);
  Object.entries(errors).forEach(([key, msg]) => {
    if (fields[key]) setFieldError(fields[key], msg);
  });
}

/* ——— Admin: enrollment credit limits ——— */

async function loadEnrollmentLimits() {
  const { data, error } = await fetchEnrollmentLimits();
  if (error) {
    showToast(mapError(error), 'error');
    return;
  }
  enrollmentLimits = data || { ...DEFAULT_ENROLLMENT_LIMITS };
}

function fillEnrollmentLimitsForm() {
  const minEl = document.getElementById('limit-min');
  const maxEl = document.getElementById('limit-max');
  if (minEl) minEl.value = String(enrollmentLimits.min_enrollment_credits);
  if (maxEl) maxEl.value = String(enrollmentLimits.max_enrollment_credits);
}

function bindEnrollmentLimitsForm() {
  const form = document.getElementById('enrollment-limits-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const minEl = form.min;
    const maxEl = form.max;
    [minEl, maxEl].forEach(clearFieldError);
    const { errors, limits } = validateEnrollmentLimitsForm(minEl.value, maxEl.value);
    if (errors.min) setFieldError(minEl, errors.min);
    if (errors.max) setFieldError(maxEl, errors.max);
    if (Object.keys(errors).length) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    const { data, error } = await updateEnrollmentLimits(limits);
    btn.disabled = false;
    if (error) {
      showToast(mapError(error), 'error');
      return;
    }
    enrollmentLimits = data || limits;
    showToast('Credit limits saved.', 'success');
    if (!isAdmin || adminPreviewMode) updateCreditLimitSummary();
  });
}

function updateCreditLimitSummary() {
  const el = document.getElementById('credit-limit-summary');
  if (!el) return;
  const current = enrolledCredits(enrollmentsCache);
  el.textContent = formatCreditLimitSummary(current, enrollmentLimits);
  el.hidden = false;
}

/* ——— Admin: catalog CRUD ——— */

async function loadSeatMap() {
  const { data, error } = await fetchSeatRemainingMap();
  if (error) {
    showToast(mapError(error), 'error');
    seatMap = {};
    return;
  }
  seatMap = data || {};
}

async function loadAdminCatalog() {
  await loadEnrollmentLimits();
  fillEnrollmentLimitsForm();
  const { data, error } = await fetchCatalog();
  if (error) {
    showToast(mapError(error), 'error');
    return;
  }
  catalogCache = data || [];
  await loadSeatMap();
  setupAdminCatalogFilters();
  const root = document.getElementById('admin-catalog-filters')?.querySelector('[data-filter-root]');
  refreshCatalogFilterOptions(root);
  renderAdminTable();
  const el = document.getElementById('course-count');
  if (el) el.textContent = String(catalogCache.length);
}

function renderAdminTable() {
  const tbody = document.getElementById('admin-catalog-tbody');
  const empty = document.getElementById('admin-catalog-empty');
  const filterEmpty = document.getElementById('admin-catalog-filter-empty');
  const root = document.getElementById('admin-catalog-filters')?.querySelector('[data-filter-root]');
  if (!tbody) return;

  if (!catalogCache.length) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    if (filterEmpty) filterEmpty.hidden = true;
    updateFilterCount(root, 0, 0);
    return;
  }
  if (empty) empty.hidden = true;

  const filtered = applyCatalogFilters(catalogCache, catalogFilters, { seatMap });
  updateFilterCount(root, filtered.length, catalogCache.length);

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (filterEmpty) filterEmpty.hidden = false;
    return;
  }
  if (filterEmpty) filterEmpty.hidden = true;

  tbody.innerHTML = filtered
    .map((c) => {
      const seats = seatMap[c.id] || { remaining: 0, enrolled: 0 };
      const cap = c.seat_capacity ?? 30;
      return `
    <tr>
      <td><strong>${escapeHtml(c.code)}</strong></td>
      <td><span class="badge badge--active">${escapeHtml(c.section || '—')}</span></td>
      <td>${escapeHtml(c.title)}</td>
      <td>${c.credits}</td>
      <td>${cellCourseType(c)}</td>
      <td>${cellPrerequisite(c)}</td>
      <td>${escapeHtml(c.instructor)}</td>
      <td>${cap}</td>
      <td>${seats.enrolled}</td>
      <td>${seats.remaining}</td>
      <td><span class="badge badge--${c.is_active ? 'active' : 'dropped'}">${c.is_active ? 'Open' : 'Closed'}</span></td>
      <td>${formatDate(c.created_at)}</td>
      <td class="table-actions">
        <button type="button" class="btn btn--ghost btn--sm btn-edit-catalog" data-id="${c.id}">Edit</button>
        <button type="button" class="btn btn--danger btn--sm btn-delete-catalog" data-id="${c.id}">Delete</button>
      </td>
    </tr>
  `;
    })
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
  if (form.section) form.section.value = 'A';
  if (form.seat_capacity) form.seat_capacity.value = '30';
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
  form.section.value = course.section || 'A';
  form.seat_capacity.value = course.seat_capacity ?? 30;
  form.credits.value = course.credits;
  form.instructor.value = course.instructor;
  if (form.course_type) form.course_type.value = course.course_type || '';
  if (form.prerequisite) form.prerequisite.value = course.prerequisite || '';
  form.is_active.checked = !!course.is_active;
  document.getElementById('form-heading').textContent = 'Edit course';
  form.querySelector('[type="submit"]').textContent = 'Save changes';
  document.getElementById('btn-cancel-edit')?.removeAttribute('hidden');
}

async function confirmDeleteCatalog(id) {
  const course = catalogCache.find((c) => c.id === id);
  if (!course) return;
  if (!window.confirm(`Delete ${formatCourseLabel(course)} from catalog? Enrollments will also be removed.`)) return;

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
      section: form.section.value,
      seat_capacity: form.seat_capacity.value,
      credits: form.credits.value,
      instructor: form.instructor.value,
      course_type: form.course_type?.value || '',
      prerequisite: form.prerequisite?.value || '',
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
  await loadEnrollmentLimits();
  const [catalogRes, enrollRes] = await Promise.all([
    fetchCatalog(),
    fetchEnrollments(currentUserId),
  ]);

  if (catalogRes.error) showToast(mapError(catalogRes.error), 'error');
  if (enrollRes.error) showToast(mapError(enrollRes.error), 'error');

  catalogCache = catalogRes.data || [];
  enrollmentsCache = enrollRes.data || [];
  await loadSeatMap();
  setupStudentAvailableFilters();
  setupStudentEnrollmentFilters();
  const availRoot = document.getElementById('student-available-filters')?.querySelector('[data-filter-root]');
  refreshCatalogFilterOptions(availRoot);

  renderAvailableCourses();
  renderMyEnrollments();
  updateCreditLimitSummary();

  const el = document.getElementById('course-count');
  if (el) el.textContent = String(enrollmentsCache.length);
}

function enrolledCourseIds() {
  return new Set(enrollmentsCache.map((e) => e.course_id));
}

function enrolledCourseCodes() {
  const codes = new Set();
  enrollmentsCache
    .filter((e) => ['enrolled', 'completed'].includes(e.status))
    .forEach((e) => {
      const code = e.course_catalog?.code;
      if (code) codes.add(code.toUpperCase());
    });
  return codes;
}

function renderAvailableCourses() {
  const tbody = document.getElementById('available-courses-tbody');
  const empty = document.getElementById('available-empty');
  const filterEmpty = document.getElementById('available-filter-empty');
  const root = document.getElementById('student-available-filters')?.querySelector('[data-filter-root]');
  if (!tbody) return;

  const base = catalogCache.filter((c) => c.is_active);
  if (!base.length) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    if (filterEmpty) filterEmpty.hidden = true;
    updateFilterCount(root, 0, 0);
    return;
  }
  if (empty) empty.hidden = true;

  const available = applyCatalogFilters(base, catalogFilters, { seatMap, activeOnly: true });
  updateFilterCount(root, available.length, base.length);

  if (!available.length) {
    tbody.innerHTML = '';
    if (filterEmpty) filterEmpty.hidden = false;
    return;
  }
  if (filterEmpty) filterEmpty.hidden = true;

  const enrolled = enrolledCourseIds();
  const enrolledCodes = enrolledCourseCodes();
  const currentCredits = enrolledCredits(enrollmentsCache);
  const maxCredits = enrollmentLimits.max_enrollment_credits;

  tbody.innerHTML = available
    .map((c) => {
      const taken = enrolled.has(c.id);
      const codeTaken = !taken && enrolledCodes.has((c.code || '').toUpperCase());
      const left = seatMap[c.id]?.remaining ?? c.seat_capacity ?? 0;
      const full = !taken && !codeTaken && left <= 0;
      const overCredit =
        !taken && !codeTaken && !full && currentCredits + (c.credits ?? 0) > maxCredits;
      return `
    <tr>
      <td><strong>${escapeHtml(c.code)}</strong></td>
      <td><span class="badge badge--active">${escapeHtml(c.section || '—')}</span></td>
      <td>${escapeHtml(c.title)}</td>
      <td>${c.credits}</td>
      <td>${cellCourseType(c)}</td>
      <td>${cellPrerequisite(c)}</td>
      <td>${escapeHtml(c.instructor)}</td>
      <td><strong>${left}</strong></td>
      <td>
        ${
          taken
            ? '<span class="badge badge--completed">Selected</span>'
            : codeTaken
              ? '<span class="badge badge--dropped" title="Same course code already selected in another section">Code taken</span>'
              : overCredit
                ? '<span class="badge badge--dropped" title="Maximum credit limit reached">Max credits</span>'
                : full
                  ? '<span class="badge badge--dropped">Full</span>'
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
  const filterEmpty = document.getElementById('enrollments-filter-empty');
  const root = document.getElementById('student-enrollment-filters')?.querySelector('[data-filter-root]');
  if (!tbody) return;

  if (!enrollmentsCache.length) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    if (filterEmpty) filterEmpty.hidden = true;
    updateFilterCount(root, 0, 0);
    return;
  }
  if (empty) empty.hidden = true;

  const filtered = applyEnrollmentFilters(enrollmentsCache, enrollmentFilters);
  updateFilterCount(root, filtered.length, enrollmentsCache.length);

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (filterEmpty) filterEmpty.hidden = false;
    return;
  }
  if (filterEmpty) filterEmpty.hidden = true;

  tbody.innerHTML = filtered
    .map((e) => {
      const c = e.course_catalog || {};
      return `
    <tr>
      <td><strong>${escapeHtml(c.code || '—')}</strong></td>
      <td><span class="badge badge--active">${escapeHtml(c.section || '—')}</span></td>
      <td>${escapeHtml(c.title || '—')}</td>
      <td>${c.credits ?? '—'}</td>
      <td>
        <select class="enrollment-status" data-id="${e.id}" aria-label="Status for ${escapeHtml(formatCourseLabel(c))}">
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
  if (isAdmin && adminPreviewMode) {
    showToast('Preview only — students enroll from this screen when signed in.', 'info');
    return;
  }
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
  if (!window.confirm(`Drop ${formatCourseLabel(c) || 'this course'}?`)) return;

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

async function handleOpenAllCourses() {
  const closed = catalogCache.filter((c) => !c.is_active).length;
  if (!closed) {
    showToast('All courses are already open.', 'info');
    return;
  }
  if (!window.confirm(`Open all ${closed} closed course(s) for student selection?`)) return;

  const btn = document.getElementById('btn-open-all');
  if (btn) btn.disabled = true;
  const { updated, error } = await openAllCatalogCourses();
  if (btn) btn.disabled = false;
  if (error) {
    showToast(mapError(error), 'error');
    return;
  }
  showToast(`Opened ${updated} course(s) for students.`, 'success');
  await loadAdminCatalog();
}

async function handleImportCurriculum() {
  if (
    !window.confirm(
      'Import all 56 CSE curriculum courses (section 1, instructor TBA)? Existing code+section rows are skipped.'
    )
  ) {
    return;
  }
  const btn = document.getElementById('btn-import-curriculum');
  if (btn) btn.disabled = true;
  const { added, skipped, error } = await importCseCurriculum();
  if (btn) btn.disabled = false;
  if (error) {
    showToast(mapError(error), 'error');
    return;
  }
  showToast(`Imported ${added} course(s). Skipped ${skipped} duplicate(s).`, 'success');
  await loadAdminCatalog();
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
    syncCoursePanels();
    updatePageHeaderForMode();
    bindAdminForm();
    bindEnrollmentLimitsForm();
    document.getElementById('btn-import-curriculum')?.addEventListener('click', handleImportCurriculum);
    document.getElementById('btn-open-all')?.addEventListener('click', handleOpenAllCourses);
    document.getElementById('btn-preview-student')?.addEventListener('click', () => setAdminPreviewMode(true));
    document.getElementById('btn-exit-preview')?.addEventListener('click', () => setAdminPreviewMode(false));
    await loadAdminCatalog();
  } else {
    document.getElementById('admin-preview-bar')?.setAttribute('hidden', '');
    if (pageTitle) pageTitle.textContent = 'My courses';
    if (pageDesc) pageDesc.textContent = 'Select courses from the catalog, then manage them under My selected courses.';
    await loadStudentViews();
  }
}
