import { createClient } from './vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';
import * as local from './local-db.js';
import { wrapAuthCall } from './errors.js';
import { roleForEmail } from './roles.js';
import { appUrl } from './app-url.js';
import { profileToDb, validateAvatarFile } from './profile-utils.js';
import { CSE_CURRICULUM, curriculumToCatalogRow } from './cse-curriculum.js';
import {
  DEFAULT_ENROLLMENT_LIMITS,
  normalizeEnrollmentLimits,
  enrolledCredits,
  checkEnrollCredits,
  checkDropCredits,
} from './enrollment-limits.js';

let supabase = null;

export function useLocalMode() {
  return !isSupabaseConfigured();
}

export function getSupabase() {
  if (useLocalMode()) return null;
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabase;
}

export async function getSession() {
  if (useLocalMode()) {
    return local.localGetSession();
  }
  const result = await wrapAuthCall(async () => {
    const client = getSupabase();
    return client.auth.getSession();
  });
  if (result.error) {
    return { session: null, error: result.error.message };
  }
  return { session: result.data?.session ?? null, error: undefined };
}

export async function signInWithPassword(credentials) {
  if (useLocalMode()) {
    return local.localSignIn(credentials);
  }
  return wrapAuthCall(async () => {
    const client = getSupabase();
    return client.auth.signInWithPassword(credentials);
  });
}

export async function signUp(payload) {
  const email = payload.email?.trim() || '';
  const role = roleForEmail(email);
  const meta = {
    ...(payload.options?.data || {}),
    role,
  };

  if (useLocalMode()) {
    return local.localSignUp({
      email,
      password: payload.password,
      fullName: meta.full_name || 'User',
      role,
    });
  }
  return wrapAuthCall(async () => {
    const client = getSupabase();
    return client.auth.signUp({
      ...payload,
      email,
      options: {
        ...payload.options,
        data: meta,
        emailRedirectTo: appUrl('login.html'),
      },
    });
  });
}

/** Remove Supabase + demo session from browser storage (always run after sign-out). */
export function clearPersistedAuth() {
  local.localSignOut();
  try {
    const ref = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') || (ref && key.includes(ref))) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore quota / private mode */
  }
}

export async function signOut() {
  if (useLocalMode()) {
    clearPersistedAuth();
    return;
  }
  const client = getSupabase();
  try {
    if (client) {
      // Local scope clears storage even when the logout API fails (offline / stale token).
      await client.auth.signOut({ scope: 'local' });
    }
  } catch {
    /* still clear below */
  } finally {
    clearPersistedAuth();
    supabase = null;
  }
}

export async function fetchProfile(userId) {
  if (useLocalMode()) {
    return local.localGetProfile(userId);
  }
  const client = getSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  return { data, error };
}

/** Create or fix profile row so admin/student roles work with RLS. */
export async function ensureProfileForUser(user) {
  if (useLocalMode() || !user?.id) return;
  const client = getSupabase();
  const role = roleForEmail(user.email || '');
  const full_name =
    user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

  const { data: existing, error } = await client
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) return;

  if (!existing) {
    await client.from('profiles').insert({ id: user.id, full_name, role, email: user.email || '' });
    return;
  }

  if (user.email && existing.email !== user.email) {
    await client.from('profiles').update({ email: user.email }).eq('id', user.id);
  }

  if (role === 'admin' && existing.role !== 'admin') {
    await client.from('profiles').update({ role: 'admin' }).eq('id', user.id);
  }
}

export async function fetchSeatRemainingMap() {
  if (useLocalMode()) {
    return local.localSeatRemainingMap();
  }
  const client = getSupabase();
  const { data, error } = await client.rpc('catalog_seat_remaining');
  if (error) return { data: null, error };
  const map = {};
  for (const row of data || []) {
    map[row.course_id] = {
      remaining: row.seats_remaining ?? 0,
      enrolled: row.seats_enrolled ?? 0,
    };
  }
  return { data: map, error: null };
}

export async function fetchCatalog() {
  if (useLocalMode()) {
    return local.localListCatalog();
  }
  const client = getSupabase();
  const { data, error } = await client
    .from('course_catalog')
    .select('*')
    .order('code', { ascending: true })
    .order('section', { ascending: true });
  return { data, error };
}

export async function insertCatalog(course) {
  if (useLocalMode()) {
    return local.localInsertCatalog(course);
  }
  const client = getSupabase();
  const { data, error } = await client.from('course_catalog').insert(course).select().single();
  return { data, error };
}

export async function importCseCurriculum() {
  let added = 0;
  let skipped = 0;
  for (const course of CSE_CURRICULUM) {
    const row = curriculumToCatalogRow(course);
    const { error } = await insertCatalog(row);
    if (error) {
      if (/already exists/i.test(error.message || '')) skipped++;
      else return { added, skipped, error };
    } else {
      added++;
    }
  }
  return { added, skipped, error: null };
}

export async function updateCatalog(id, course) {
  if (useLocalMode()) {
    return local.localUpdateCatalog(id, course);
  }
  const client = getSupabase();
  const { data, error } = await client.from('course_catalog').update(course).eq('id', id).select().single();
  return { data, error };
}

export async function openAllCatalogCourses() {
  if (useLocalMode()) {
    return local.localOpenAllCatalog();
  }
  const client = getSupabase();
  const { data, error } = await client
    .from('course_catalog')
    .update({ is_active: true })
    .not('code', 'is', null)
    .select('id');
  return { updated: (data || []).length, error };
}

export async function deleteCatalog(id) {
  if (useLocalMode()) {
    return local.localDeleteCatalog(id);
  }
  const client = getSupabase();
  const { error } = await client.from('course_catalog').delete().eq('id', id);
  return { error };
}

export async function fetchEnrollmentLimits() {
  if (useLocalMode()) {
    return local.localGetEnrollmentLimits();
  }
  const client = getSupabase();
  const { data, error } = await client.from('portal_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return { data: null, error };
  return { data: normalizeEnrollmentLimits(data || DEFAULT_ENROLLMENT_LIMITS), error: null };
}

export async function updateEnrollmentLimits(limits) {
  const normalized = normalizeEnrollmentLimits(limits);
  if (useLocalMode()) {
    return local.localUpdateEnrollmentLimits(normalized);
  }
  const client = getSupabase();
  const { data, error } = await client
    .from('portal_settings')
    .upsert({ id: 1, ...normalized })
    .select('*')
    .single();
  return { data: data ? normalizeEnrollmentLimits(data) : null, error };
}

export async function fetchEnrollments(userId) {
  if (useLocalMode()) {
    return local.localListEnrollments(userId);
  }
  const client = getSupabase();
  const { data, error } = await client
    .from('enrollments')
    .select('*, course_catalog(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function enrollInCourse(userId, courseId) {
  if (useLocalMode()) {
    return local.localEnroll(userId, courseId);
  }
  const client = getSupabase();
  const { data: targetCourse, error: courseErr } = await client
    .from('course_catalog')
    .select('id, code, is_active, credits')
    .eq('id', courseId)
    .single();
  if (courseErr || !targetCourse?.is_active) {
    return { data: null, error: { message: 'Course is not available.' } };
  }
  const { data: existing, error: existErr } = await client
    .from('enrollments')
    .select('id, course_id, status, course_catalog(code, credits)')
    .eq('user_id', userId)
    .in('status', ['enrolled', 'completed']);
  if (existErr) return { data: null, error: existErr };
  const codeKey = targetCourse.code.toUpperCase();
  if ((existing || []).some((e) => e.course_id === courseId)) {
    return { data: null, error: { message: 'You are already enrolled in this course.' } };
  }
  if (
    (existing || []).some(
      (e) => e.course_catalog?.code?.toUpperCase() === codeKey && e.course_id !== courseId
    )
  ) {
    return {
      data: null,
      error: { message: 'You already selected this course code in another section.' },
    };
  }
  const { data: limits } = await fetchEnrollmentLimits();
  const creditCheck = checkEnrollCredits(
    enrolledCredits(existing),
    targetCourse.credits ?? 0,
    limits || DEFAULT_ENROLLMENT_LIMITS
  );
  if (!creditCheck.ok) {
    return { data: null, error: { message: creditCheck.message } };
  }
  const { data: seatMap } = await fetchSeatRemainingMap();
  const seats = seatMap?.[courseId];
  if (seats && seats.remaining <= 0) {
    return { data: null, error: { message: 'No seats available.' } };
  }
  const { data, error } = await client
    .from('enrollments')
    .insert({ user_id: userId, course_id: courseId, status: 'enrolled' })
    .select('*, course_catalog(*)')
    .single();
  return { data, error };
}

export async function dropEnrollment(userId, enrollmentId) {
  if (useLocalMode()) {
    return local.localDropEnrollment(userId, enrollmentId);
  }
  const client = getSupabase();
  const { data: row, error: rowErr } = await client
    .from('enrollments')
    .select('id, status, course_catalog(credits)')
    .eq('id', enrollmentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (rowErr) return { error: rowErr };
  if (!row) return { error: { message: 'Enrollment not found.' } };
  if (['enrolled', 'completed'].includes(row.status)) {
    const { data: active } = await client
      .from('enrollments')
      .select('status, course_catalog(credits)')
      .eq('user_id', userId)
      .in('status', ['enrolled', 'completed']);
    const { data: limits } = await fetchEnrollmentLimits();
    const dropCheck = checkDropCredits(
      enrolledCredits(active),
      row.course_catalog?.credits ?? 0,
      limits || DEFAULT_ENROLLMENT_LIMITS
    );
    if (!dropCheck.ok) return { error: { message: dropCheck.message } };
  }
  const { error } = await client.from('enrollments').delete().eq('id', enrollmentId).eq('user_id', userId);
  return { error };
}

export async function adminDropEnrollment(userId, enrollmentId) {
  if (useLocalMode()) {
    return local.localAdminDropEnrollment(userId, enrollmentId);
  }
  const client = getSupabase();
  const { error } = await client
    .from('enrollments')
    .delete()
    .eq('id', enrollmentId)
    .eq('user_id', userId);
  return { error };
}

export async function adminChangeEnrollmentCourse(userId, enrollmentId, newCourseId) {
  if (useLocalMode()) {
    return local.localAdminChangeEnrollmentCourse(userId, enrollmentId, newCourseId);
  }
  const client = getSupabase();
  const { data: row, error: rowErr } = await client
    .from('enrollments')
    .select('id, course_id, status')
    .eq('id', enrollmentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (rowErr) return { data: null, error: rowErr };
  if (!row) return { data: null, error: { message: 'Enrollment not found.' } };
  if (row.course_id === newCourseId) {
    return fetchEnrollments(userId).then(({ data }) => ({
      data: (data || []).find((e) => e.id === enrollmentId) || null,
      error: null,
    }));
  }

  const { data: target, error: targetErr } = await client
    .from('course_catalog')
    .select('id, code')
    .eq('id', newCourseId)
    .maybeSingle();
  if (targetErr) return { data: null, error: targetErr };
  if (!target) return { data: null, error: { message: 'Course not found.' } };

  const { data: duplicate, error: dupErr } = await client
    .from('enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', newCourseId)
    .neq('id', enrollmentId)
    .maybeSingle();
  if (dupErr) return { data: null, error: dupErr };
  if (duplicate) return { data: null, error: { message: 'Student is already in that course section.' } };

  const { data, error } = await client
    .from('enrollments')
    .update({ course_id: newCourseId, status: 'enrolled' })
    .eq('id', enrollmentId)
    .eq('user_id', userId)
    .select('*, course_catalog(*)')
    .single();
  return { data, error };
}

export async function updateEnrollmentStatus(userId, enrollmentId, status) {
  if (useLocalMode()) {
    return local.localUpdateEnrollment(userId, enrollmentId, { status });
  }
  const client = getSupabase();
  const { data, error } = await client
    .from('enrollments')
    .update({ status })
    .eq('id', enrollmentId)
    .eq('user_id', userId)
    .select('*, course_catalog(*)')
    .single();
  return { data, error };
}

export async function updateProfile(userId, patch) {
  const dbPatch = profileToDb(patch);
  if (useLocalMode()) {
    return local.localUpdateProfile(userId, dbPatch);
  }
  const client = getSupabase();
  const { data, error } = await client
    .from('profiles')
    .update(dbPatch)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

export async function fetchStudentProfiles() {
  if (useLocalMode()) {
    return local.localListStudents();
  }
  const client = getSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('full_name', { ascending: true });
  return { data, error };
}

export async function uploadAvatar(userId, file) {
  const msg = validateAvatarFile(file);
  if (msg) return { data: null, url: null, error: { message: msg } };

  if (useLocalMode()) {
    return local.localUploadAvatar(userId, file);
  }

  const client = getSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await client.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  });
  if (uploadError) return { data: null, url: null, error: uploadError };

  const { data: urlData } = client.storage.from('avatars').getPublicUrl(path);
  const avatar_url = `${urlData.publicUrl}?v=${Date.now()}`;
  const { data, error } = await updateProfile(userId, { avatar_url });
  return { data, url: avatar_url, error };
}

export async function fetchAnnouncements() {
  if (useLocalMode()) {
    return local.localListAnnouncements();
  }
  const client = getSupabase();
  const { data, error } = await client
    .from('announcements')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function insertAnnouncement(row) {
  if (useLocalMode()) {
    return local.localInsertAnnouncement(row);
  }
  const client = getSupabase();
  const { data, error } = await client.from('announcements').insert(row).select().single();
  return { data, error };
}

export async function deleteAnnouncement(id) {
  if (useLocalMode()) {
    return local.localDeleteAnnouncement(id);
  }
  const client = getSupabase();
  const { error } = await client.from('announcements').delete().eq('id', id);
  return { error };
}
