/** Shared filter bar markup (injected into courses page) */

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
