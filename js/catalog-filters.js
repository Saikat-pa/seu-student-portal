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
