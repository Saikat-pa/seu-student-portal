import { createClient } from './vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';
import * as local from './local-db.js';
import { wrapAuthCall } from './errors.js';
import { roleForEmail } from './roles.js';
import { appUrl } from './app-url.js';

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

export async function signOut() {
  if (useLocalMode()) {
    await local.localSignOut();
    return;
  }
  const client = getSupabase();
  if (client) await client.auth.signOut();
}

export async function fetchProfile(userId) {
  if (useLocalMode()) {
    return local.localGetProfile(userId);
  }
  const client = getSupabase();
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  return { data, error };
}

export async function fetchCatalog() {
  if (useLocalMode()) {
    return local.localListCatalog();
  }
  const client = getSupabase();
  const { data, error } = await client
    .from('course_catalog')
    .select('*')
    .order('code', { ascending: true });
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

export async function updateCatalog(id, course) {
  if (useLocalMode()) {
    return local.localUpdateCatalog(id, course);
  }
  const client = getSupabase();
  const { data, error } = await client.from('course_catalog').update(course).eq('id', id).select().single();
  return { data, error };
}

export async function deleteCatalog(id) {
  if (useLocalMode()) {
    return local.localDeleteCatalog(id);
  }
  const client = getSupabase();
  const { error } = await client.from('course_catalog').delete().eq('id', id);
  return { error };
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
  const { error } = await client.from('enrollments').delete().eq('id', enrollmentId).eq('user_id', userId);
  return { error };
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
