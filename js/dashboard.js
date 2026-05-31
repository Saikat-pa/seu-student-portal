import { requireAuth, getUserProfile } from './auth.js';
import { isAdminRole } from './roles.js';
import { fetchCatalog, fetchEnrollments } from './api.js';
import { escapeHtml, formatCourseLabel } from './utils.js';

async function loadStudentDashboard(userId) {
  const { data, error } = await fetchEnrollments(userId);
  if (error) {
    document.getElementById('stat-total').textContent = '—';
    return;
  }

  const rows = data || [];
  const enrolled = rows.filter((e) => e.status === 'enrolled');
  const completed = rows.filter((e) => e.status === 'completed');
  const credits = enrolled.reduce((sum, e) => sum + (e.course_catalog?.credits || 0), 0);

  document.getElementById('stat-total').textContent = String(rows.length);
  document.getElementById('stat-active').textContent = String(enrolled.length);
  document.getElementById('stat-completed').textContent = String(completed.length);
  document.getElementById('stat-credits').textContent = String(credits);

  document.getElementById('stat-label-total').textContent = 'Selected courses';
  document.getElementById('stat-label-active').textContent = 'Enrolled';
  document.getElementById('stat-label-completed').textContent = 'Completed';
  document.getElementById('stat-label-credits').textContent = 'Enrolled credits';

  const list = document.getElementById('recent-courses');
  const empty = document.getElementById('recent-empty');

  if (!rows.length) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = 'No courses selected. <a href="courses.html">Browse catalog</a>.';
    return;
  }

  empty.hidden = true;
  list.innerHTML = rows.slice(0, 5).map((e) => {
    const c = e.course_catalog || {};
    return `
    <li class="recent-item">
      <div>
        <span class="recent-item__code">${escapeHtml(formatCourseLabel(c))}</span>
        <span class="recent-item__title">${escapeHtml(c.title || '')}</span>
      </div>
      <span class="badge badge--${e.status === 'enrolled' ? 'active' : e.status}">${escapeHtml(e.status)}</span>
    </li>
  `;
  }).join('');
}

async function loadAdminDashboard() {
  const { data, error } = await fetchCatalog();
  if (error) {
    document.getElementById('stat-total').textContent = '—';
    return;
  }

  const catalog = data || [];
  const open = catalog.filter((c) => c.is_active).length;

  document.getElementById('stat-total').textContent = String(catalog.length);
  document.getElementById('stat-active').textContent = String(open);
  document.getElementById('stat-completed').textContent = '—';
  document.getElementById('stat-credits').textContent = '—';

  document.getElementById('stat-label-total').textContent = 'Catalog courses';
  document.getElementById('stat-label-active').textContent = 'Open for students';
  document.getElementById('stat-label-completed').textContent = '—';
  document.getElementById('stat-label-credits').textContent = '—';

  const list = document.getElementById('recent-courses');
  const empty = document.getElementById('recent-empty');

  if (!catalog.length) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = 'Catalog empty. <a href="courses.html">Add courses</a>.';
    return;
  }

  empty.hidden = true;
  list.innerHTML = catalog.slice(0, 5).map((c) => `
    <li class="recent-item">
      <div>
        <span class="recent-item__code">${escapeHtml(formatCourseLabel(c))}</span>
        <span class="recent-item__title">${escapeHtml(c.title)}</span>
      </div>
      <span class="badge badge--${c.is_active ? 'active' : 'dropped'}">${c.is_active ? 'Open' : 'Closed'}</span>
    </li>
  `).join('');
}

export async function initDashboardPage() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await getUserProfile();
  const nameEl = document.getElementById('dashboard-name');
  const emailEl = document.getElementById('dashboard-email');
  const roleEl = document.getElementById('dashboard-role');

  if (profile) {
    if (nameEl) nameEl.textContent = profile.fullName;
    if (emailEl) emailEl.textContent = profile.email;
    if (roleEl) {
      roleEl.textContent = isAdminRole(profile.role) ? 'Administrator' : 'Student';
      roleEl.className = `badge badge--${isAdminRole(profile.role) ? 'completed' : 'active'}`;
    }
  }

  const recentTitle = document.getElementById('recent-title');
  const coursesQuick = document.getElementById('quick-courses');
  const isAdmin = isAdminRole(profile?.role);

  if (isAdmin) {
    if (recentTitle) recentTitle.textContent = 'Catalog preview';
    if (coursesQuick) {
      coursesQuick.querySelector('strong').textContent = 'Add courses';
      coursesQuick.querySelector('span').textContent =
        'Open the course catalog to add, edit, or remove courses for students.';
    }
    await loadAdminDashboard();
  } else {
    if (recentTitle) recentTitle.textContent = 'My recent courses';
    if (coursesQuick) {
      coursesQuick.querySelector('strong').textContent = 'Select courses';
      coursesQuick.querySelector('span').textContent =
        'Browse available courses and enroll with one click.';
    }
    await loadStudentDashboard(session.user.id);
  }
}
