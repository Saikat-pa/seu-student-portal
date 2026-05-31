import { roleForEmail } from './roles.js';

const DB_KEY = 'student_portal_db_v2';
const SESSION_KEY = 'student_portal_session';

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { users: [], catalog: [], enrollments: [] };
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
          created_at: now,
        }
      );

      const c1 = uuid();
      const c2 = uuid();
      db.catalog.push(
        {
          id: c1,
          title: 'Introduction to Computer Science',
          code: 'CS101',
          section: 'A',
          credits: 3,
          instructor: 'Dr. Rahman',
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: c2,
          title: 'Calculus I',
          code: 'MATH101',
          section: '1',
          credits: 4,
          instructor: 'Prof. Khan',
          is_active: true,
          created_at: now,
          updated_at: now,
        }
      );

      db.enrollments.push({
        id: uuid(),
        user_id: studentId,
        course_id: c1,
        status: 'enrolled',
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
      full_name: user.full_name,
      role: user.role,
    },
    error: null,
  };
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

export async function localEnroll(userId, courseId) {
  const db = loadDb();
  const course = db.catalog.find((c) => c.id === courseId && c.is_active);
  if (!course) return { error: { message: 'Course is not available.' } };
  if (db.enrollments.some((e) => e.user_id === userId && e.course_id === courseId)) {
    return { error: { message: 'You are already enrolled in this course.' } };
  }
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
  const before = db.enrollments.length;
  db.enrollments = db.enrollments.filter((e) => !(e.id === enrollmentId && e.user_id === userId));
  if (db.enrollments.length === before) return { error: { message: 'Enrollment not found.' } };
  saveDb(db);
  return { error: null };
}

export async function localUpdateEnrollment(userId, enrollmentId, patch) {
  const db = loadDb();
  const idx = db.enrollments.findIndex((e) => e.id === enrollmentId && e.user_id === userId);
  if (idx === -1) return { error: { message: 'Enrollment not found.' } };
  db.enrollments[idx] = { ...db.enrollments[idx], ...patch };
  saveDb(db);
  return { data: attachCourse(db, db.enrollments[idx]), error: null };
}
