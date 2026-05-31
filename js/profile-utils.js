/** Shared profile field mapping and display helpers */

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

export function mapProfileRow(row, fallbackEmail = '') {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || fallbackEmail || '',
    fullName: row.full_name || '',
    role: row.role || 'student',
    batch: row.batch || '',
    department: row.department || '',
    session: row.session || '',
    gender: row.gender || '',
    contactNumber: row.contact_number || '',
    cgpa: row.cgpa != null && row.cgpa !== '' ? Number(row.cgpa) : null,
    avatarUrl: row.avatar_url || '',
    createdAt: row.created_at,
  };
}

export function profileToDb(patch) {
  const out = {};
  if (patch.full_name != null) out.full_name = String(patch.full_name).trim();
  if (patch.fullName != null) out.full_name = String(patch.fullName).trim();
  if (patch.batch != null) out.batch = String(patch.batch).trim();
  if (patch.department != null) out.department = String(patch.department).trim();
  if (patch.session != null) out.session = String(patch.session).trim();
  if (patch.gender != null) out.gender = String(patch.gender).trim();
  if (patch.contact_number != null) out.contact_number = String(patch.contact_number).trim();
  if (patch.contactNumber != null) out.contact_number = String(patch.contactNumber).trim();
  if (patch.email != null) out.email = String(patch.email).trim().toLowerCase();
  if (patch.avatar_url != null) out.avatar_url = patch.avatar_url;
  if (patch.avatarUrl != null) out.avatar_url = patch.avatarUrl;
  if (patch.cgpa === '' || patch.cgpa === null) out.cgpa = null;
  else if (patch.cgpa != null) out.cgpa = Number(patch.cgpa);
  return out;
}

export function avatarInitials(name) {
  const parts = String(name || 'U')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || 'U').toUpperCase();
}

export function formatCgpa(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(2);
}

export function validateAdminProfilePatch(patch) {
  return validateProfilePatch(patch);
}

export function validateProfilePatch(patch) {
  const errors = {};
  const name = (patch.full_name ?? patch.fullName ?? '').trim();
  if (!name || name.length < 2) errors.full_name = 'Name is required (min 2 characters).';
  const email = (patch.email ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (patch.cgpa != null && patch.cgpa !== '') {
    const n = Number(patch.cgpa);
    if (Number.isNaN(n) || n < 0 || n > 4) errors.cgpa = 'CGPA must be between 0 and 4.';
  }
  return errors;
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function validateAvatarFile(file) {
  if (!file) return 'Choose a photo.';
  if (!AVATAR_TYPES.includes(file.type)) return 'Use JPG, PNG, WebP, or GIF.';
  if (file.size > AVATAR_MAX_BYTES) return 'Photo must be 2 MB or smaller.';
  return '';
}
