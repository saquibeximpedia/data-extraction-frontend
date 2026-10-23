# Trade Data Web App (Next.js)

The app people use: sign-in, countries and their months, extraction history, files, and accounts. Its own server routes (`src/app/api`) read and write Supabase with the service-role key.

Extracting is done by a separate **extraction service**, the Node backend in `../backend`. The browser calls that service directly, and only for extracting and live extractions. Everything else keeps working while the service is offline.

## Pages

- **Dashboard**: every country with its latest completed month, the last 12 published months as a strip, and when it last changed. While the extraction service is live, extractable countries get an **Extract** button. Download-only countries get **Upload files**.
- **Country**: headline numbers, then every year with its months marked **completed**, **extracting** or **not done**. Click **Edit months** to paint them: pick a status, then click or drag across months, click a year for all of it, or shift-click to fill a span. A date range can be painted too. Nothing is saved until **Save changes**. The page also shows the source details, recent extractions, and the upload form for download-only countries.
- **Extract** (in the navbar only while the service is live): country, one month or a date range (with presets), trade flow, data set, and a slide-down for specific HS codes. Alongside: the months already done (with a link to the full list) and the country's source details.
- **Extractions**: what runs on the service now (progress, stop), then previous extractions from the database. Open one for live logs while it runs, or its results after.
- **Files**: countries in a sidebar with file counts and sizes. A country shows year tabs over a 12-month board, one card per month with its files. Search, filter by extracted or uploaded, a "Recent" view, and multi-select to download as one zip or delete.
- **Settings**: the extraction service URL for this browser (e.g. `http://localhost:3000` when you run it yourself), with a connection test.
- **Admin** (admins only): accounts and roles; country details and links; download-only countries.

The navbar pill shows whether the extraction service is live (checked every 15 seconds) and opens Settings.

## Getting started

Requires Node.js 22.13+.

```bash
cp .env.example .env.local   # Supabase URL + anon key, the service_role key, the bucket, the service URL
npm install
npm run dev                  # http://localhost:3001
npm run create-admin -- --email you@company.com --password 'a-long-password'   # first admin, once
```

`.env.local`:

| Variable | Meaning |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon / publishable key, used in the browser for sign-in |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Used by the `/api` routes; never prefixed with `NEXT_PUBLIC_`, never in the browser bundle |
| `SUPABASE_BUCKET` | The bucket the extraction service writes to (same as its `SUPABASE_BUCKET`) |
| `NEXT_PUBLIC_EXTRACTION_SERVICE_URL` | Default extraction service URL; each browser can override it in Settings (default `http://localhost:3000`) |

`NEXT_PUBLIC_*` values are built into the bundle, so rebuild after changing them. For production: `npm run build && npm run start`.

Run `../backend/supabase/schema.sql` in the Supabase SQL editor, then start the extraction service once: it publishes its countries to the database, and the dashboard lists them from there. Turn off public sign-ups in Supabase (**Authentication → Sign In / Providers**) so only admins create accounts.

## API (this app)

Every route needs `Authorization: Bearer <Supabase access token>`. The client in `src/lib/api.ts` adds it.

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/me` | all | The signed-in user and role |
| `GET /api/countries` | all | Countries with source, settings, completed and extracting months |
| `POST /api/countries/:code/months` | all | `{ changes: [{ period, status }] }`; `status` is `completed`, `extracting` or `null` (clears) |
| `POST /api/countries` · `PATCH/DELETE /api/countries/:code` | admin | Add a download-only country; edit details; remove a download-only country |
| `GET /api/runs?limit=&country=` · `GET /api/runs/:id` | all | Extraction history |
| `GET /api/files` · `GET /api/files/url?path=` | all | Stored files; a 5-minute signed download link |
| `POST /api/files/zip` · `POST /api/files/delete` | all | `{ paths }` → one zip / delete |
| `POST /api/files/upload` | all | `{ country, period, name }` → a one-time signed upload; the browser uploads straight to Storage |
| `GET/POST /api/admin/users` · `PATCH/DELETE /api/admin/users/:id` | admin | Accounts |

## Layout

```
src/
├── app/
│   ├── api/          # Server routes (service-role Supabase): me, countries, months, runs, files, admin
│   ├── login/        # Sign-in
│   └── (app)/        # Dashboard, countries/[code], extract, extractions (+ [id]), files, settings, admin
├── server/           # Server-only code for the routes: supabase, http (auth, errors), countries, runs, files, users
├── components/       # Page sections; components/ui/ holds the primitives
└── lib/              # api.ts (this app's API + the extraction service), store.tsx (global state), types, months
```
