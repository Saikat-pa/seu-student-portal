import { copyFileSync, writeFileSync } from 'fs';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
const adminEmails = process.env.ADMIN_EMAILS || "['admin@student.local']";

if (url && key) {
  const content = `/** Auto-generated for GitHub Pages — from repository Secrets */
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
  console.log('GitHub Pages: Supabase config written from repository secrets.');
} else {
  copyFileSync('js/config.public.js', 'js/config.js');
  console.log('GitHub Pages: Supabase config from js/config.public.js (no Secrets needed).');
}
