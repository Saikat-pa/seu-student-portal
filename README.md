# SEU Student Portal

Static student portal for Southeast University — course selection, dashboard, and login.

## Live demo

After GitHub Pages is enabled, the site is published at:

`https://<your-github-username>.github.io/seu-student-portal/`

**Demo login (no Supabase):** `demo@student.local` / `demo12345`

## Supabase

GitHub Pages uses `js/config.public.js` automatically (no Secrets required). Optional overrides: repository **Secrets** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (`Settings → Secrets → Actions`).

Run `supabase/install-once.sql` once in the [SQL Editor](https://supabase.com/dashboard/project/vhoamzowtnwscfwirpvq/sql/new).

Local setup: copy `js/config.example.js` to `js/config.js` and run `npm start`. Verify with `npm run check`.
