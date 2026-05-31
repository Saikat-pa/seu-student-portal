import { roleForEmail } from './roles.js';
import { validateAvatarFile } from './profile-utils.js';
import { CSE_CURRICULUM, curriculumToCatalogRow } from './cse-curriculum.js';
import {
  DEFAULT_ENROLLMENT_LIMITS,
  normalizeEnrollmentLimits,
  enrolledCredits,
  checkEnrollCredits,
  checkDropCredits,
} from './enrollment-limits.js';

const DB_KEY = 'student_portal_db_v2';
const SESSION_KEY = 'student_portal_session';

function ensureSettings(db) {
  if (!db.settings) {
    db.settings = { ...DEFAULT_ENROLLMENT_LIMITS };
  }
  db.settings = normalizeEnrollmentLimits(db.settings);
  return db.settings;
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (!db.announcements) db.announcements = [];
      ensureSettings(db);
      return db;
    }
  } catch {
    /* ignore */
  }
  const db = { users: [], catalog: [], enrollments: [], announcements: [], settings: null };
  ensureSettings(db);
  return db;
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function uuid() {
  return crypto.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toSession(user) {
  return {
    user: {
      id: user.id,
      email: user.email,
      user_metadata: { full_name: user.full_name, role: user.role },
    },
  };
}

let seedPromise = null;

export function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const db = loadDb();
      if (db.users.length > 0) return;

      const now = new Date().toISOString();
      const adminId = uuid();
      const studentId = uuid();

      db.users.push(
        {
          id: adminId,
          email: 'admin@student.local',
          passwordHash: await hashPassword('admin12345'),
          full_name: 'Demo Admin',
          role: 'admin',
          created_at: now,
        },
        {
          id: studentId,
          email: 'demo@student.local',
          passwordHash: await hashPassword('demo12345'),
          full_name: 'Demo Student',
          role: 'student',
          avatar_url: '',
          batch: '58',
          department: 'CSE',
          session: '2021-2022',
          gender: 'Male',
          contact_number: '01700000000',
          cgpa: 3.65,
          created_at: now,
        }
      );

      db.catalog = CSE_CURRICULUM.map((course) => ({
        id: uuid(),
        ...curriculumToCatalogRow(course, { is_active: false }),
        created_at: now,
        updated_at: now,
      }));

      const demoCourse = db.catalog.find((c) => c.code === 'CSE1201');
      if (demoCourse) {
        db.enrollments.push({
          id: uuid(),
          user_id: studentId,
          course_id: demoCourse.id,
          status: 'enrolled',
          created_at: now,
        });
      }

      db.announcements.push({
        id: uuid(),
        title: 'Summer 2026 registration open',
        body: 'Browse the course catalog and select your sections before seats fill up.',
        is_pinned: true,
        created_at: now,
      });

      saveDb(db);
    })();
  }
  return seedPromise;
}

export async function localGetSession() {
  await ensureSeeded();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { session: null };
    const session = JSON.parse(raw);
    const db = loadDb();
    const user = db.users.find((u) => u.id === session?.user?.id);
    if (!user) {
      sessionStorage.removeItem(SESSION_KEY);
      return { session: null };
    }
    return { session: toSession(user) };
  } catch {
    return { session: null };
  }
}

export async function localGetProfile(userId) {
  await ensureSeeded();
  const db = loadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return { data: null, error: { message: 'Profile not found' } };
  return {
    data: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      avatar_url: user.avatar_url || '',
      batch: user.batch || '',
      department: user.department || '',
      session: user.session || '',
      gender: user.gender || '',
      contact_number: user.contact_number || '',
      cgpa: user.cgpa ?? null,
      created_at: user.created_at,
    },
    error: null,
  };
}

function applyProfilePatch(user, patch) {
  if (patch.full_name != null) user.full_name = String(patch.full_name).trim();
  if (patch.email != null) user.email = String(patch.email).trim().toLowerCase();
  if (patch.avatar_url != null) user.avatar_url = patch.avatar_url;
  if (patch.batch != null) user.batch = String(patch.batch).trim();
  if (patch.department != null) user.department = String(patch.department).trim();
  if (patch.session != null) user.session = String(patch.session).trim();
  if (patch.gender != null) user.gender = String(patch.gender).trim();
  if (patch.contact_number != null) user.contact_number = String(patch.contact_number).trim();
  if (patch.cgpa === null || patch.cgpa === '') user.cgpa = null;
  else if (patch.cgpa != null) user.cgpa = Number(patch.cgpa);
}

export async function localUpdateProfile(userId, patch) {
  await ensureSeeded();
  const db = loadDb();
  const { session } = await localGetSession();
  const actorId = session?.user?.id;
  const actor = db.users.find((u) => u.id === actorId);
  const user = db.users.find((u) => u.id === userId);
  if (!user) return { data: null, error: { message: 'Profile not found' } };

  const isAdmin = actor?.role === 'admin';
  if (!isAdmin && actorId !== userId) {
    return { data: null, error: { message: 'Admin access only.' } };
  }
  if (!isAdmin && actorId === userId) {
    const keys = Object.keys(patch);
    if (keys.some((k) => k !== 'avatar_url')) {
      return {
        data: null,
        error: { message: 'Students can only update profile photo on the Profile page.' },
      };
    }
  }
  if (!isAdmin && patch.role != null) {
    delete patch.role;
  }

  applyProfilePatch(user, patch);
  saveDb(db);

  if (session?.user?.id === userId && patch.full_name != null) {
    session.user.user_metadata.full_name = user.full_name;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return localGetProfile(userId);
}

export async function localUploadAvatar(userId, file) {
  const msg = validateAvatarFile(file);
  if (msg) return { data: null, url: null, error: { message: msg } };

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const { data, error } = await localUpdateProfile(userId, { avatar_url: reader.result });
      resolve({ data, url: reader.result, error });
    };
    reader.onerror = () => resolve({ data: null, url: null, error: { message: 'Could not read photo.' } });
    reader.readAsDataURL(file);
  });
}

export async function localListStudents() {
  const gate = await requireAdminUser();
  if (!gate.ok) return { data: null, error: { message: gate.message } };
  await ensureSeeded();
  const db = loadDb();
  const rows = db.users
    .filter((u) => u.role === 'student')
    .map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      avatar_url: u.avatar_url || '',
      batch: u.batch || '',
      department: u.department || '',
      session: u.session || '',
      gender: u.gender || '',
      contact_number: u.contact_number || '',
      cgpa: u.cgpa ?? null,
      created_at: u.created_at,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  return { data: rows, error: null };
}

export async function localListAnnouncements() {
  await ensureSeeded();
  const db = loadDb();
  const rows = [...(db.announcements || [])].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  return { data: rows, error: null };
}

export async function localInsertAnnouncement(row) {
  const gate = await requireAdminUser();
  if (!gate.ok) return { error: { message: gate.message } };
  const db = loadDb();
  const item = {
    id: uuid(),
    title: row.title,
    body: row.body || '',
    is_pinned: !!row.is_pinned,
    created_at: new Date().toISOString(),
  };
  if (!db.announcements) db.announcements = [];
  db.announcements.push(item);
  saveDb(db);
  return { data: item, error: null };
}

export async function localDeleteAnnouncement(id) {
  const gate = await requireAdminUser();
  if (!gate.ok) return { error: { message: gate.message } };
  const db = loadDb();
  const before = (db.announcements || []).length;
  db.announcements = (db.announcements || []).filter((a) => a.id !== id);
  if (db.announcements.length === before) return { error: { message: 'Notice not found.' } };
  saveDb(db);
  return { error: null };
}

export async function localSignUp({ email, password, fullName, role }) {
  await ensureSeeded();
  const db = loadDb();
  const normalized = email.trim().toLowerCase();
  const resolvedRole = role || roleForEmail(normalized);

  if (db.users.some((u) => u.email === normalized)) {
    return { error: { message: 'An account with this email already exists.' } };
  }

  const user = {
    id: uuid(),
    email: normalized,
    passwordHash: await hashPassword(password),
    full_name: fullName.trim(),
    role: resolvedRole,
    avatar_url: '',
    batch: '',
    department: '',
    session: '',
    gender: '',
    contact_number: '',
    cgpa: null,
    created_at: new Date().toISOString(),
  };

  db.users.push(user);
  saveDb(db);

  const session = toSession(user);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { data: { user: session.user, session }, error: null };
}

export async function localSignIn({ email, password }) {
  await ensureSeeded();
  const db = loadDb();
  const normalized = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email === normalized);

  if (!user) {
    return { error: { message: 'Invalid email or password.' } };
  }

  const passwordHash = await hashPassword(password);
  if (user.passwordHash !== passwordHash) {
    return { error: { message: 'Invalid email or password.' } };
  }

  const session = toSession(user);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { data: { user: session.user, session }, error: null };
}

export async function localSignOut() {
  sessionStorage.removeItem(SESSION_KEY);
}

function countSeatsUsed(db, courseId) {
  return db.enrollments.filter(
    (e) => e.course_id === courseId && ['enrolled', 'completed'].includes(e.status)
  ).length;
}

function userHasActiveCode(db, userId, code, exceptEnrollmentId = null) {
  const codeKey = code.toUpperCase();
  return db.enrollments.some((e) => {
    if (e.user_id !== userId || !['enrolled', 'completed'].includes(e.status)) return false;
    if (exceptEnrollmentId && e.id === exceptEnrollmentId) return false;
    const c = db.catalog.find((cat) => cat.id === e.course_id);
    return c && c.code.toUpperCase() === codeKey;
  });
}

export async function localSeatRemainingMap() {
  await ensureSeeded();
  const db = loadDb();
  const map = {};
  for (const c of db.catalog) {
    const enrolled = countSeatsUsed(db, c.id);
    const cap = c.seat_capacity ?? 30;
    map[c.id] = {
      remaining: Math.max(0, cap - enrolled),
      enrolled,
    };
  }
  return { data: map, error: null };
}

export async function localListCatalog() {
  await ensureSeeded();
  const db = loadDb();
  return {
    data: [...db.catalog].sort(
      (a, b) =>
        a.code.localeCompare(b.code) || (a.section || '').localeCompare(b.section || '')
    ),
    error: null,
  };
}

async function requireAdminUser() {
  const { session } = await localGetSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: 'Sign in required.' };
  const db = loadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.role !== 'admin') {
    return { ok: false, message: 'Only admins can manage the course catalog.' };
  }
  return { ok: true };
}

export async function localInsertCatalog(course) {
  const gate = await requireAdminUser();
  if (!gate.ok) return { error: { message: gate.message } };
  const db = loadDb();
  const now = new Date().toISOString();
  const codeKey = course.code.toUpperCase();
  const sectionKey = (course.section || 'A').toUpperCase();
  if (
    db.catalog.some(
      (c) => c.code.toUpperCase() === codeKey && (c.section || 'A').toUpperCase() === sectionKey
    )
  ) {
    return { error: { message: 'This course code and section already exists.' } };
  }
  const row = { id: uuid(), ...course, created_at: now, updated_at: now };
  db.catalog.push(row);
  saveDb(db);
  return { data: row, error: null };
}

export async function localOpenAllCatalog() {
  const gate = await requireAdminUser();
  if (!gate.ok) return { updated: 0, error: { message: gate.message } };
  const db = loadDb();
  const now = new Date().toISOString();
  let updated = 0;
  for (const course of db.catalog) {
    if (!course.is_active) {
      course.is_active = true;
      course.updated_at = now;
      updated++;
    }
  }
  saveDb(db);
  return { updated, error: null };
}

export async function localCloseAllCatalog() {
  const gate = await requireAdminUser();
  if (!gate.ok) return { updated: 0, error: { message: gate.message } };
  const db = loadDb();
  const now = new Date().toISOString();
  let updated = 0;
  for (const course of db.catalog) {
    if (course.is_active) {
      course.is_active = false;
      course.updated_at = now;
      updated++;
    }
  }
  saveDb(db);
  return { updated, error: null };
}

export async function localUpdateCatalog(id, course) {
  const gate = await requireAdminUser();
  if (!gate.ok) return { error: { message: gate.message } };
  const db = loadDb();
  const idx = db.catalog.findIndex((c) => c.id === id);
  if (idx === -1) return { error: { message: 'Course not found.' } };
  const codeKey = course.code?.toUpperCase();
  const sectionKey = (course.section || 'A').toUpperCase();
  if (
    codeKey &&
    db.catalog.some(
      (c) =>
        c.id !== id &&
        c.code.toUpperCase() === codeKey &&
        (c.section || 'A').toUpperCase() === sectionKey
    )
  ) {
    return { error: { message: 'This course code and section already exists.' } };
  }
  db.catalog[idx] = { ...db.catalog[idx], ...course, updated_at: new Date().toISOString() };
  saveDb(db);
  return { data: db.catalog[idx], error: null };
}

export async function localDeleteCatalog(id) {
  const gate = await requireAdminUser();
  if (!gate.ok) return { error: { message: gate.message } };
  const db = loadDb();
  const before = db.catalog.length;
  db.catalog = db.catalog.filter((c) => c.id !== id);
  db.enrollments = db.enrollments.filter((e) => e.course_id !== id);
  if (db.catalog.length === before) return { error: { message: 'Course not found.' } };
  saveDb(db);
  return { error: null };
}

function attachCourse(db, enrollment) {
  const course = db.catalog.find((c) => c.id === enrollment.course_id);
  return { ...enrollment, course_catalog: course || null };
}

export async function localListEnrollments(userId) {
  await ensureSeeded();
  const db = loadDb();
  const rows = db.enrollments
    .filter((e) => e.user_id === userId)
    .map((e) => attachCourse(db, e))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return { data: rows, error: null };
}

export async function localGetEnrollmentLimits() {
  await ensureSeeded();
  const db = loadDb();
  return { data: ensureSettings(db), error: null };
}

export async function localUpdateEnrollmentLimits(limits) {
  const gate = await requireAdminUser();
  if (!gate.ok) return { data: null, error: { message: gate.message } };
  const db = loadDb();
  db.settings = normalizeEnrollmentLimits(limits);
  saveDb(db);
  return { data: db.settings, error: null };
}

export async function localEnroll(userId, courseId) {
  const db = loadDb();
  const course = db.catalog.find((c) => c.id === courseId && c.is_active);
  if (!course) return { error: { message: 'Course is not available.' } };
  if (db.enrollments.some((e) => e.user_id === userId && e.course_id === courseId)) {
    return { error: { message: 'You are already enrolled in this course.' } };
  }
  if (userHasActiveCode(db, userId, course.code)) {
    return { error: { message: 'You already selected this course code in another section.' } };
  }
  const cap = course.seat_capacity ?? 30;
  if (countSeatsUsed(db, courseId) >= cap) {
    return { error: { message: 'No seats available.' } };
  }
  const limits = ensureSettings(db);
  const activeRows = db.enrollments
    .filter((e) => e.user_id === userId && ['enrolled', 'completed'].includes(e.status))
    .map((e) => attachCourse(db, e));
  const creditCheck = checkEnrollCredits(enrolledCredits(activeRows), course.credits ?? 0, limits);
  if (!creditCheck.ok) return { error: { message: creditCheck.message } };
  const row = {
    id: uuid(),
    user_id: userId,
    course_id: courseId,
    status: 'enrolled',
    created_at: new Date().toISOString(),
  };
  db.enrollments.push(row);
  saveDb(db);
  return { data: attachCourse(db, row), error: null };
}

export async function localDropEnrollment(userId, enrollmentId) {
  const db = loadDb();
  const row = db.enrollments.find((e) => e.id === enrollmentId && e.user_id === userId);
  if (!row) return { error: { message: 'Enrollment not found.' } };
  if (['enrolled', 'completed'].includes(row.status)) {
    const course = db.catalog.find((c) => c.id === row.course_id);
    const activeRows = db.enrollments
      .filter((e) => e.user_id === userId && ['enrolled', 'completed'].includes(e.status))
      .map((e) => attachCourse(db, e));
    const dropCheck = checkDropCredits(
      enrolledCredits(activeRows),
      course?.credits ?? 0,
      ensureSettings(db)
    );
    if (!dropCheck.ok) return { error: { message: dropCheck.message } };
  }
  db.enrollments = db.enrollments.filter((e) => !(e.id === enrollmentId && e.user_id === userId));
  saveDb(db);
  return { error: null };
}

export async function localUpdateEnrollment(userId, enrollmentId, patch) {
  const db = loadDb();
  const idx = db.enrollments.findIndex((e) => e.id === enrollmentId && e.user_id === userId);
  if (idx === -1) return { error: { message: 'Enrollment not found.' } };
  const next = { ...db.enrollments[idx], ...patch };
  if (['enrolled', 'completed'].includes(next.status)) {
    const course = db.catalog.find((c) => c.id === next.course_id);
    if (course && userHasActiveCode(db, userId, course.code, enrollmentId)) {
      return { error: { message: 'You already selected this course code in another section.' } };
    }
  }
  db.enrollments[idx] = next;
  saveDb(db);
  return { data: attachCourse(db, db.enrollments[idx]), error: null };
}

export async function localAdminDropEnrollment(userId, enrollmentId) {
  const gate = await requireAdminUser();
  if (!gate.ok) return { error: { message: gate.message } };
  const db = loadDb();
  const exists = db.enrollments.some((e) => e.id === enrollmentId && e.user_id === userId);
  if (!exists) return { error: { message: 'Enrollment not found.' } };
  db.enrollments = db.enrollments.filter((e) => !(e.id === enrollmentId && e.user_id === userId));
  saveDb(db);
  return { error: null };
}

export async function localAdminChangeEnrollmentCourse(userId, enrollmentId, newCourseId) {
  const gate = await requireAdminUser();
  if (!gate.ok) return { data: null, error: { message: gate.message } };
  const db = loadDb();
  const idx = db.enrollments.findIndex((e) => e.id === enrollmentId && e.user_id === userId);
  if (idx === -1) return { data: null, error: { message: 'Enrollment not found.' } };
  const course = db.catalog.find((c) => c.id === newCourseId);
  if (!course) return { data: null, error: { message: 'Course not found.' } };
  if (db.enrollments.some((e) => e.user_id === userId && e.course_id === newCourseId && e.id !== enrollmentId)) {
    return { data: null, error: { message: 'Student is already in that course section.' } };
  }
  if (userHasActiveCode(db, userId, course.code, enrollmentId)) {
    return { data: null, error: { message: 'Student already has this course code in another section.' } };
  }
  db.enrollments[idx] = { ...db.enrollments[idx], course_id: newCourseId, status: 'enrolled' };
  saveDb(db);
  return { data: attachCourse(db, db.enrollments[idx]), error: null };
}
