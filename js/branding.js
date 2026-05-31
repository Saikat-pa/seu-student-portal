/** Southeast University branding — https://seu.edu.bd/ */
export const UNIVERSITY = {
  name: 'Southeast University',
  shortName: 'SEU',
  motto: 'Meeting the challenges of Time',
  website: 'https://seu.edu.bd/',
  admission: 'https://admission.seu.edu.bd/',
  ums: 'https://ums.seu.edu.bd/',
  address: '251/A & 252, Tejgaon Industrial Area, Dhaka 1208, Bangladesh',
  phone: '01766348518',
  logoDark: 'assets/seu-logo.png',
  logoLight: 'assets/seu-logo-light.png',
  campus: 'assets/seu-campus.jpg',
  established: 2002,
};

export function logoForTheme(theme) {
  return theme === 'light' ? UNIVERSITY.logoLight : UNIVERSITY.logoDark;
}

export function logoHtml(theme = 'dark') {
  return `
    <img src="${logoForTheme(theme)}" alt="${UNIVERSITY.name}" class="logo__img seu-logo" height="38" />
    <span class="logo__badge">Student Portal</span>
  `;
}

export function updateLogos(theme) {
  const resolved = theme || document.documentElement.getAttribute('data-theme') || 'dark';
  const src = logoForTheme(resolved);
  document.querySelectorAll('.seu-logo, .logo__img, .hero__logo, .about-hero__logo').forEach((img) => {
    img.src = src;
  });
}

export function applyBranding() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';

  document.querySelectorAll('.logo').forEach((el) => {
    if (el.querySelector('.logo__img')) return;
    el.innerHTML = logoHtml(theme);
  });

  updateLogos(theme);

  document.querySelectorAll('[data-footer-brand]').forEach((el) => {
    el.innerHTML = `
      <strong><a href="${UNIVERSITY.website}" target="_blank" rel="noopener">${UNIVERSITY.name}</a></strong>
      · Tejgaon, Dhaka ·
      <a href="${UNIVERSITY.website}" target="_blank" rel="noopener">seu.edu.bd</a>
    `;
  });
}
