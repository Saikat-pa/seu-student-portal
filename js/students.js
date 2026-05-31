import { requireAdmin, getUserProfile } from './auth.js';
import {
  fetchStudentProfiles,
  updateProfile,
  fetchEnrollments,
  fetchCatalog,
  adminDropEnrollment,
  adminChangeEnrollmentCourse,
} from './api.js';
import {
  avatarInitials,
  formatCgpa,
  mapProfileRow,
  validateAdminProfilePatch,
} from './profile-utils.js';
import { bindFilterForm, fillSelect } from './catalog-filters.js';
import { escapeHtml, showToast, setFieldError, clearFieldError, formatCourseLabel } from './utils.js';

let studentsCache = [];
let listFilters = { search: '', department: '', batch: '' };
let catalogCache = [];
let enrollmentsStudentId = null;
let enrollmentsCache = [];

function readStudentListFilters(root) {
  return {
    search: root.querySelector('[data-filter-field="search"]')?.value ?? '',
    department: root.querySelector('[data-filter-field="department"]')?.value ?? '',
    batch: root.querySelector('[data-filter-field="batch"]')?.value ?? '',
  };
}

function filterStudents(list) {
  let rows = [...list];
  const q = listFilters.search.trim().toLowerCase();
  if (q) {
    rows = rows.filter((s) => {
      const hay = `${s.fullName} ${s.email} ${s.batch} ${s.department} ${s.session} ${s.contactNumber}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (listFilters.department) rows = rows.filter((s) => s.department === listFilters.department);
  if (listFilters.batch) rows = rows.filter((s) => s.batch === listFilters.batch);
  return rows;
}

function refreshFilterOptions(root) {
  const depts = [...new Set(studentsCache.map((s) => s.department).filter(Boolean))].sort();
  const batches = [...new Set(studentsCache.map((s) => s.batch).filter(Boolean))].sort();
  fillSelect(root.querySelector('[data-filter-field="department"]'), depts, { allLabel: 'All departments' });
  fillSelect(root.querySelector('[data-filter-field="batch"]'), batches, { allLabel: 'All batches' });
}

function avatarCell(profile) {
  if (profile.avatarUrl) {
    return `<img class="avatar avatar--sm" src="${escapeHtml(profile.avatarUrl)}" alt="" />`;
  }
  return `<div class="avatar avatar--sm avatar--placeholder">${escapeHtml(avatarInitials(profile.fullName))}</div>`;
}

function courseChangeOptions(enrollment, studentEnrollments) {
  const currentId = enrollment.course_id;
  const takenCourseIds = new Set(studentEnrollments.map((e) => e.course_id));
  const takenCodes = new Set(
    studentEnrollments
      .filter((e) => e.id !== enrollment.id && ['enrolled', 'completed'].includes(e.status))
      .map((e) => e.course_catalog?.code?.toUpperCase())
      .filter(Boolean)
  );

  const options = catalogCache
    .filter((c) => c.id !== currentId && !takenCourseIds.has(c.id))
    .filter((c) => !takenCodes.has(c.code?.toUpperCase()))
    .sort((a, b) => `${a.code}${a.section}`.localeCompare(`${b.code}${b.section}`))
    .map((c) => {
      const label = `${c.code} · ${c.section} — ${c.title}${c.is_active ? '' : ' (closed)'}`;
      return `<option value="${c.id}">${escapeHtml(label)}</option>`;
    });

  if (!options.length) {
    return '<option value="">No other section available</option>';
  }
  return `<option value="">Choose course…</option>${options.join('')}`;
}

function renderEnrollmentsDialog() {
  const tbody = document.getElementById('student-enrollments-tbody');
  const empty = document.getElementById('student-enrollments-empty');
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
      <td>${escapeHtml(c.section || '—')}</td>
      <td>${escapeHtml(c.title || '—')}</td>
      <td>${c.credits ?? '—'}</td>
      <td>
        <select class="enrollment-change-select" data-id="${e.id}" aria-label="Change ${escapeHtml(formatCourseLabel(c))}">
          ${courseChangeOptions(e, enrollmentsCache)}
        </select>
      </td>
      <td class="table-actions">
        <button type="button" class="btn btn--danger btn--sm btn-remove-enrollment" data-id="${e.id}">Remove</button>
      </td>
    </tr>
  `;
    })
    .join('');

  tbody.querySelectorAll('.btn-remove-enrollment').forEach((btn) => {
    btn.addEventListener('click', () => handleRemoveEnrollment(btn.dataset.id));
  });

  tbody.querySelectorAll('.enrollment-change-select').forEach((sel) => {
    sel.addEventListener('change', () => handleChangeEnrollment(sel.dataset.id, sel.value, sel));
  });
}

async function openEnrollmentsDialog(studentId) {
  const student = studentsCache.find((s) => s.id === studentId);
  if (!student) return;

  enrollmentsStudentId = studentId;
  const dialog = document.getElementById('student-enrollments-dialog');
  const title = document.getElementById('enrollments-dialog-title');
  if (title) title.textContent = `Courses — ${student.fullName || 'Student'}`;
  document.getElementById('enrollments-student-id').value = studentId;

  if (!catalogCache.length) {
    const { data, error } = await fetchCatalog();
    if (error) {
      showToast(error.message || 'Could not load course catalog.', 'error');
      return;
    }
    catalogCache = data || [];
  }

  const { data, error } = await fetchEnrollments(studentId);
  if (error) {
    showToast(error.message || 'Could not load enrollments.', 'error');
    return;
  }
  enrollmentsCache = (data || []).filter((e) => ['enrolled', 'completed'].includes(e.status));
  renderEnrollmentsDialog();
  dialog?.showModal();
}

async function handleRemoveEnrollment(enrollmentId) {
  if (!enrollmentsStudentId) return;
  const row = enrollmentsCache.find((e) => e.id === enrollmentId);
  const label = formatCourseLabel(row?.course_catalog) || 'this course';
  if (!window.confirm(`Remove ${label} from this student?`)) return;

  const { error } = await adminDropEnrollment(enrollmentsStudentId, enrollmentId);
  if (error) {
    showToast(error.message || 'Could not remove course.', 'error');
    return;
  }
  showToast('Course removed.', 'success');
  enrollmentsCache = enrollmentsCache.filter((e) => e.id !== enrollmentId);
  renderEnrollmentsDialog();
}

async function handleChangeEnrollment(enrollmentId, newCourseId, selectEl) {
  if (!enrollmentsStudentId || !newCourseId) {
    if (selectEl) selectEl.value = '';
    return;
  }
  const row = enrollmentsCache.find((e) => e.id === enrollmentId);
  const target = catalogCache.find((c) => c.id === newCourseId);
  const fromLabel = formatCourseLabel(row?.course_catalog) || 'course';
  const toLabel = formatCourseLabel(target) || 'new course';
  if (!window.confirm(`Change ${fromLabel} to ${toLabel}?`)) {
    if (selectEl) selectEl.value = '';
    return;
  }

  const { data, error } = await adminChangeEnrollmentCourse(
    enrollmentsStudentId,
    enrollmentId,
    newCourseId
  );
  if (error) {
    showToast(error.message || 'Could not change course.', 'error');
    if (selectEl) selectEl.value = '';
    return;
  }
  showToast('Course changed.', 'success');
  enrollmentsCache = enrollmentsCache.map((e) => (e.id === enrollmentId ? data || e : e));
  renderEnrollmentsDialog();
}

function renderTable() {
  const tbody = document.getElementById('students-tbody');
  const empty = document.getElementById('students-empty');
  const filterEmpty = document.getElementById('students-filter-empty');
  const root = document.getElementById('student-list-filters');
  if (!tbody) return;

  if (!studentsCache.length) {
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    if (filterEmpty) filterEmpty.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;

  const filtered = filterStudents(studentsCache);
  const countEl = root?.querySelector('[data-filter-count]');
  if (countEl) countEl.textContent = `Showing ${filtered.length} of ${studentsCache.length}`;

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (filterEmpty) filterEmpty.hidden = false;
    return;
  }
  if (filterEmpty) filterEmpty.hidden = true;

  tbody.innerHTML = filtered
    .map(
      (s) => `
    <tr>
      <td>${avatarCell(s)}</td>
      <td><strong>${escapeHtml(s.fullName || '—')}</strong></td>
      <td>${escapeHtml(s.batch || '—')}</td>
      <td>${escapeHtml(s.department || '—')}</td>
      <td>${escapeHtml(s.session || '—')}</td>
      <td>${escapeHtml(s.gender || '—')}</td>
      <td>${escapeHtml(s.contactNumber || '—')}</td>
      <td>${escapeHtml(s.email || '—')}</td>
      <td>${formatCgpa(s.cgpa)}</td>
      <td class="table-actions">
        <button type="button" class="btn btn--ghost btn--sm btn-edit-student" data-id="${s.id}">Edit</button>
        <button type="button" class="btn btn--ghost btn--sm btn-student-courses" data-id="${s.id}">Courses</button>
      </td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('.btn-edit-student').forEach((btn) => {
    btn.addEventListener('click', () => openEditDialog(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-student-courses').forEach((btn) => {
    btn.addEventListener('click', () => openEnrollmentsDialog(btn.dataset.id));
  });
}

function openEditDialog(id) {
  const student = studentsCache.find((s) => s.id === id);
  if (!student) return;
  const dialog = document.getElementById('student-edit-dialog');
  const form = document.getElementById('student-edit-form');
  if (!dialog || !form) return;

  document.getElementById('edit-student-id').value = id;
  form.full_name.value = student.fullName || '';
  form.batch.value = student.batch || '';
  form.department.value = student.department || '';
  form.session.value = student.session || '';
  form.gender.value = student.gender || '';
  form.contact_number.value = student.contactNumber || '';
  form.email.value = student.email || '';
  form.cgpa.value = student.cgpa != null ? student.cgpa : '';

  dialog.showModal();
}

async function loadStudents() {
  const { data, error } = await fetchStudentProfiles();
  if (error) {
    showToast(error.message || 'Could not load students.', 'error');
    return;
  }
  studentsCache = (data || []).map((row) => mapProfileRow(row, row.email));
  const root = document.getElementById('student-list-filters');
  refreshFilterOptions(root);
  renderTable();
}

function bindEditForm() {
  const dialog = document.getElementById('student-edit-dialog');
  const form = document.getElementById('student-edit-form');
  document.getElementById('edit-cancel')?.addEventListener('click', () => dialog?.close());

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-student-id').value;
    const patch = {
      full_name: form.full_name.value,
      batch: form.batch.value,
      department: form.department.value,
      session: form.session.value,
      gender: form.gender.value,
      contact_number: form.contact_number.value,
      email: form.email.value,
      cgpa: form.cgpa.value,
    };

    form.querySelectorAll('input, select').forEach(clearFieldError);
    const errors = validateAdminProfilePatch(patch);
    if (Object.keys(errors).length) {
      if (errors.full_name) setFieldError(form.full_name, errors.full_name);
      if (errors.cgpa) setFieldError(form.cgpa, errors.cgpa);
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    const { error } = await updateProfile(id, patch);
    btn.disabled = false;
    if (error) {
      showToast(error.message || 'Save failed.', 'error');
      return;
    }
    showToast('Student updated.', 'success');
    dialog?.close();
    await loadStudents();
  });
}

function bindEnrollmentsDialog() {
  document.getElementById('enrollments-dialog-close')?.addEventListener('click', () => {
    document.getElementById('student-enrollments-dialog')?.close();
  });
}

export async function initStudentsPage() {
  const session = await requireAdmin();
  if (!session) return;

  await getUserProfile();

  const root = document.getElementById('student-list-filters');
  bindFilterForm(root, readStudentListFilters, () => {
    listFilters = readStudentListFilters(root);
    renderTable();
  });

  bindEditForm();
  bindEnrollmentsDialog();
  await loadStudents();
}
