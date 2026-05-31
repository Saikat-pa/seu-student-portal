/** Base path for GitHub Pages (e.g. /seu-student-portal/) or / locally. */
export function appBasePath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  parts.pop();
  return `/${parts.join('/')}/`;
}

export function appUrl(relativePath = '') {
  const clean = String(relativePath).replace(/^\//, '');
  return `${window.location.origin}${appBasePath()}${clean}`;
}
