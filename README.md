# SEU Student Portal

Static student portal for Southeast University — course selection, dashboard, and login.

## Live demo

After GitHub Pages is enabled, the site is published at:

`https://<your-github-username>.github.io/seu-student-portal/`

**Demo login (no Supabase):** `demo@student.local` / `demo12345`

## Supabase (optional)

To use a live backend on GitHub Pages, add these repository **Secrets** (`Settings → Secrets → Actions`):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Then re-run the **Deploy GitHub Pages** workflow or push to `main`.

Local setup: copy `js/config.example.js` to `js/config.js` and run `npm start`.
