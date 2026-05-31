/** Client-side filter/sort for course catalog and enrollments */

export function defaultCatalogFilters() {
  return {
    search: '',
    section: '',
    instructor: '',
    credits: '',
    seatFilter: 'all',
    sort: 'code-asc',
    openOnly: false,
  };
}

export function defaultEnrollmentFilters() {
  return {
    search: '',
    status: '',
    sort: 'code-asc',
  };
}

export function catalogFilterOptions(courses) {
  const sections = [...new Set(courses.map((c) => c.section).filter(Boolean))].sort();
  const instructors = [...new Set(courses.map((c) => c.instructor).filter(Boolean))].sort();
  const credits = [...new Set(courses.map((c) => c.credits).filter((n) => n != null))].sort(
    (a, b) => a - b
  );
  return { sections, instructors, credits };
}

function matchSearch(course, q) {
  if (!q) return true;
  const hay = `${course.code} ${course.title} ${course.instructor} ${course.section || ''}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function applyCatalogFilters(courses, filters, { seatMap = {}, activeOnly = false } = {}) {
  let list = [...courses];
  if (activeOnly) list = list.filter((c) => c.is_active);
  if (filters.openOnly) list = list.filter((c) => c.is_active);

  if (filters.section) list = list.filter((c) => (c.section || '') === filters.section);
  if (filters.instructor) list = list.filter((c) => c.instructor === filters.instructor);
  if (filters.credits) list = list.filter((c) => String(c.credits) === String(filters.credits));
  if (filters.search?.trim()) list = list.filter((c) => matchSearch(c, filters.search.trim()));

  if (filters.seatFilter === 'available') {
    list = list.filter((c) => (seatMap[c.id]?.remaining ?? c.seat_capacity ?? 0) > 0);
  } else if (filters.seatFilter === 'full') {
    list = list.filter((c) => (seatMap[c.id]?.remaining ?? c.seat_capacity ?? 0) <= 0);
  }

  const sort = filters.sort || 'code-asc';
  list.sort((a, b) => {
    switch (sort) {
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '');
      case 'credits-desc':
        return (b.credits || 0) - (a.credits || 0);
      case 'credits-asc':
        return (a.credits || 0) - (b.credits || 0);
      case 'seats-desc':
        return (
          (seatMap[b.id]?.remaining ?? b.seat_capacity ?? 0) -
          (seatMap[a.id]?.remaining ?? a.seat_capacity ?? 0)
        );
      case 'code-desc':
        return (b.code || '').localeCompare(a.code || '');
      default:
        return (
          (a.code || '').localeCompare(b.code || '') ||
          (a.section || '').localeCompare(b.section || '')
        );
    }
  });

  return list;
}

export function applyEnrollmentFilters(enrollments, filters) {
  let list = [...enrollments];
  if (filters.status) list = list.filter((e) => e.status === filters.status);
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter((e) => {
      const c = e.course_catalog || {};
      const hay = `${c.code} ${c.title} ${c.instructor} ${c.section || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }
  const sort = filters.sort || 'code-asc';
  list.sort((a, b) => {
    const ca = a.course_catalog || {};
    const cb = b.course_catalog || {};
    if (sort === 'title-asc') return (ca.title || '').localeCompare(cb.title || '');
    if (sort === 'credits-desc') return (cb.credits || 0) - (ca.credits || 0);
    return (
      (ca.code || '').localeCompare(cb.code || '') ||
      (ca.section || '').localeCompare(cb.section || '')
    );
  });
  return list;
}

export function fillSelect(select, values, { allLabel = 'All' } = {}) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${allLabel}</option>`;
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = String(v);
    select.appendChild(opt);
  }
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

export function bindFilterForm(root, getFilters, onChange) {
  if (!root) return;
  const inputs = root.querySelectorAll('input, select');
  const run = () => onChange(getFilters(root));
  inputs.forEach((el) => {
    el.addEventListener('input', run);
    el.addEventListener('change', run);
  });
  root.querySelector('[data-filter-reset]')?.addEventListener('click', () => {
    root.querySelectorAll('[data-filter-field]').forEach((el) => {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
    const sort = root.querySelector('[data-filter-field="sort"]');
    if (sort) sort.value = 'code-asc';
    onChange(getFilters(root));
  });
}

export function readCatalogFilters(root) {
  const q = (name) => root.querySelector(`[data-filter-field="${name}"]`)?.value ?? '';
  const openOnly = root.querySelector('[data-filter-field="openOnly"]')?.checked ?? false;
  return {
    search: q('search'),
    section: q('section'),
    instructor: q('instructor'),
    credits: q('credits'),
    seatFilter: q('seatFilter') || 'all',
    sort: q('sort') || 'code-asc',
    openOnly,
  };
}

export function readEnrollmentFilters(root) {
  const q = (name) => root.querySelector(`[data-filter-field="${name}"]`)?.value ?? '';
  return {
    search: q('search'),
    status: q('status'),
    sort: q('sort') || 'code-asc',
  };
}

export function catalogFilterBarHtml(idPrefix) {
  return `
<div class="filter-bar" id="${idPrefix}-filters" data-filter-root>
  <div class="filter-bar__row">
    <div class="form-group filter-bar__search">
      <label for="${idPrefix}-search">Search</label>
      <input type="search" id="${idPrefix}-search" data-filter-field="search" placeholder="Code, title, instructor…" autocomplete="off" />
    </div>
    <div class="form-group">
      <label for="${idPrefix}-section">Section</label>
      <select id="${idPrefix}-section" data-filter-field="section"></select>
    </div>
    <div class="form-group">
      <label for="${idPrefix}-instructor">Instructor</label>
      <select id="${idPrefix}-instructor" data-filter-field="instructor"></select>
    </div>
    <div class="form-group">
      <label for="${idPrefix}-credits">Credits</label>
      <select id="${idPrefix}-credits" data-filter-field="credits"></select>
    </div>
    <div class="form-group">
      <label for="${idPrefix}-seats">Seats</label>
      <select id="${idPrefix}-seats" data-filter-field="seatFilter">
        <option value="all">All</option>
        <option value="available">Has seats</option>
        <option value="full">Full</option>
      </select>
    </div>
    <div class="form-group">
      <label for="${idPrefix}-sort">Sort</label>
      <select id="${idPrefix}-sort" data-filter-field="sort">
        <option value="code-asc">Code A→Z</option>
        <option value="code-desc">Code Z→A</option>
        <option value="title-asc">Title A→Z</option>
        <option value="credits-desc">Credits high→low</option>
        <option value="seats-desc">Most seats left</option>
      </select>
    </div>
  </div>
  <div class="filter-bar__actions">
    <label class="checkbox-label filter-bar__check">
      <input type="checkbox" data-filter-field="openOnly" id="${idPrefix}-open" />
      Open courses only
    </label>
    <button type="button" class="btn btn--ghost btn--sm" data-filter-reset>Reset filters</button>
    <span class="filter-bar__count" data-filter-count></span>
  </div>
</div>`;
}

export function enrollmentFilterBarHtml(idPrefix) {
  return `
<div class="filter-bar filter-bar--compact" id="${idPrefix}-filters" data-filter-root>
  <div class="filter-bar__row">
    <div class="form-group filter-bar__search">
      <label for="${idPrefix}-search">Search</label>
      <input type="search" id="${idPrefix}-search" data-filter-field="search" placeholder="Search my courses…" autocomplete="off" />
    </div>
    <div class="form-group">
      <label for="${idPrefix}-status">Status</label>
      <select id="${idPrefix}-status" data-filter-field="status">
        <option value="">All</option>
        <option value="enrolled">Enrolled</option>
        <option value="completed">Completed</option>
        <option value="dropped">Dropped</option>
      </select>
    </div>
    <div class="form-group">
      <label for="${idPrefix}-sort">Sort</label>
      <select id="${idPrefix}-sort" data-filter-field="sort">
        <option value="code-asc">Code A→Z</option>
        <option value="title-asc">Title A→Z</option>
        <option value="credits-desc">Credits high→low</option>
      </select>
    </div>
    <button type="button" class="btn btn--ghost btn--sm" data-filter-reset>Reset</button>
    <span class="filter-bar__count" data-filter-count></span>
  </div>
</div>`;
}
