/**
 * Public Supabase credentials for GitHub Pages (anon/publishable — safe in repo).
 * Override via repository Secrets SUPABASE_URL and SUPABASE_ANON_KEY if preferred.
 */
export const SUPABASE_URL = 'https://vhoamzowtnwscfwirpvq.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZob2Ftem93dG53c2Nmd2lycHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDY5OTIsImV4cCI6MjA5NTc4Mjk5Mn0.-uLLzbO5s2f3SqnIeKoKnPRyorm2PG5A8wDAmPpuqlk';

export const ADMIN_EMAILS = ['admin@student.local'];

export function isSupabaseConfigured() {
  return (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('YOUR_SUPABASE') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')
  );
}
