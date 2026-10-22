# Data Extraction Web UI (Next.js)

Frontend for the data-extraction API (`../backend`). Users sign in with Supabase (email and password; accounts are created by an admin).

Pages:

- **Dashboard**: every country with its latest completed month; per country a year × month grid to mark months (or a date range) completed or remove them, and a button to that country's extraction page.
- **Extract**: country (preselected from the dashboard via `?country=`), one month or a date range with presets, trade flow, dataset (complete by default), and HS codes under "Advanced". Download-only countries show their source website and an upload form instead.
- **Extractions**: running and previous extractions with progress; open one to see its live logs.
- **Files**: files in Supabase Storage, grouped by country and year; search, multi-select, download (zip for several) and delete.
- **Admin** (admins only): create, promote and delete accounts and set passwords; edit country details and links; add download-only countries.

The browser calls the Express API directly (the API allows cross-origin requests), so the API sees each browser's real IP for its `ALLOWED_IPS` check.

## Getting started

Requires Node.js 22.13+ and the backend running (default `http://localhost:3000`).

```bash
cp .env.example .env.local   # then set the Supabase URL and anon key
npm install
npm run dev                  # UI on http://localhost:3001
```

`.env.local`:

| Variable | Meaning |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon / publishable key. Never the service_role key: that one stays in the backend. |
| `NEXT_PUBLIC_API_URL` | Optional. Defaults to the host the page was opened on, port 3000 |

`NEXT_PUBLIC_*` values are built into the bundle, so rebuild after changing them. For production: `npm run build && npm run start`.

## Layout

```
src/
├── app/             # login/ and (app)/ pages: Dashboard, Extract, Extractions (+ [id]), Files, Admin
├── components/      # Page sections; components/ui/ holds the primitives
└── lib/             # supabase.ts (sign-in), store.tsx (global state), api.ts, types.ts
```
