export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;
export const COURSE_CODE_REGEX = /^[A-Za-z]{2,4}\d{3,4}$/;

export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function setFieldError(input, message) {
  const group = input.closest('.form-group');
  if (!group) return;
  let err = group.querySelector('.field-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error';
    err.setAttribute('role', 'alert');
    group.appendChild(err);
  }
  err.textContent = message;
  input.classList.add('input--error');
  input.setAttribute('aria-invalid', 'true');
}

export function clearFieldError(input) {
  const group = input.closest('.form-group');
  if (group) {
    const err = group.querySelector('.field-error');
    if (err) err.textContent = '';
  }
  input.classList.remove('input--error');
  input.removeAttribute('aria-invalid');
}

export function validateEmail(value) {
  if (!value?.trim()) return 'Email is required.';
  if (!EMAIL_REGEX.test(value.trim())) return 'Enter a valid email address.';
  return '';
}

export function validatePassword(value, { confirm = false, other = '' } = {}) {
  if (!value) return 'Password is required.';
  if (value.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (confirm && value !== other) return 'Passwords do not match.';
  return '';
}

export function validateCatalogForm(data) {
  const errors = {};
  const title = data.title?.trim();
  const code = data.code?.trim().toUpperCase();
  const credits = Number(data.credits);
  const instructor = data.instructor?.trim();
  const isActive = data.is_active === true || data.is_active === 'true' || data.is_active === 'on';

  if (!title || title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  } else if (title.length > 120) {
    errors.title = 'Title must be 120 characters or fewer.';
  }

  if (!code) {
    errors.code = 'Course code is required (e.g. CS101).';
  } else if (!COURSE_CODE_REGEX.test(code)) {
    errors.code = 'Use format like CS101 or MATH1201.';
  }

  if (!Number.isInteger(credits) || credits < 1 || credits > 12) {
    errors.credits = 'Credits must be a whole number from 1 to 12.';
  }

  if (!instructor) {
    errors.instructor = 'Instructor name is required.';
  } else if (instructor.length > 80) {
    errors.instructor = 'Instructor name is too long.';
  }

  return {
    errors,
    values: { title, code, credits, instructor, is_active: isActive },
  };
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
