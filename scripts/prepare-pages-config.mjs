import { writeFileSync } from 'fs';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
const adminEmails = process.env.ADMIN_EMAILS || "['admin@student.local']";

const content = `/** Auto-generated for GitHub Pages — do not edit; change repo Secrets instead */
export const SUPABASE_URL = ${JSON.stringify(url)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(key)};
export const ADMIN_EMAILS = ${adminEmails};

export function isSupabaseConfigured() {
  return (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('YOUR_SUPABASE') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')
  );
}
`;

writeFileSync('js/config.js', content);
console.log(
  url && key
    ? 'GitHub Pages: Supabase config written from repository secrets.'
    : 'GitHub Pages: demo mode (no Supabase secrets). Login: demo@student.local / demo12345'
);
