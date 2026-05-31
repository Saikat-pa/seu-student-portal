# SEU Student Portal

Static student portal for Southeast University — courses, profiles, notices, and admin tools.

## Live site

**https://saikat-pa.github.io/seu-student-portal/**

## One-time setup

1. Open [setup.html](https://saikat-pa.github.io/seu-student-portal/setup.html) on the live site (or locally).
2. Copy **`supabase/upgrade-all.sql`** → [SQL Editor](https://supabase.com/dashboard/project/vhoamzowtnwscfwirpvq/sql/new) → Run.
3. Set [Auth URLs](https://supabase.com/dashboard/project/vhoamzowtnwscfwirpvq/auth/url-configuration) (see [supabase/auth-urls.md](supabase/auth-urls.md)).
4. Register on the live site, then set your account to admin in SQL (see setup page).
5. Click **Check again** on setup — all items should show ✓.

Fresh empty Supabase project? Use **`supabase/install-once.sql`** instead.

Verify locally: `npm run check`

## Features

- **Student:** login, course select (filters), profile view, photo upload, notices, dashboard
- **Admin:** course catalog (section, seats), student directory (edit all fields), notices, filters

**Demo (no Supabase):** `demo@student.local` / `demo12345`

## Deploy

GitHub Pages uses `js/config.public.js` automatically. Optional Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

Local: copy `js/config.example.js` → `js/config.js`, then `npm start`.
