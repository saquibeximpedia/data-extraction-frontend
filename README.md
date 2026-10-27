# Trade Data Web App (Next.js)

The app people use: sign-in, countries and their months, extraction history, files, and accounts. Its own server routes (`src/app/api`) read and write Supabase with the service-role key.

Extracting is done by a separate **extraction service**, the Node backend in `../backend`. The browser calls that service directly, and only for extracting and live extractions. Everything else keeps working while the service is offline.

## Pages

### The flow

Each country moves through the same loop, and every page points at the next step:

1. **Due**: the source should have published months that aren't completed yet.
2. **Extract** them (or **upload** the files, for download-only countries). Extracting marks the months **extracting**.
3. **Watch** the extraction live. When it ends, a toast says so on whatever page you are on.
4. **Check** the files, then **mark the months completed** in one click (the toast offers **Undo**).

What a country needs next is worked out in one place (`src/lib/status.ts`): months to check come first, then a running extraction, then due months, otherwise it is up to date.

### Pages

- **Dashboard**: headline numbers (up to date, to check, due, running), then the 8 most urgent countries, each with its latest completed month, the last 12 published months as a strip, and its next step. **See all countries** opens the Countries page. You can filter the list (all, needs action, up to date). A search lists every match.
- **Countries**: one compact row per country (next step, latest completed month, source, and Extract or Upload). Details are on each country's page. Admins can **Add country**.
- **Country**: headline numbers, a **Next step** card, then every year with its months marked **completed**, **extracting** or **not done**. Click **Edit months** to paint them: pick a status, then click or drag across months, click a year for all of it, or shift-click to fill a span. A date range can be painted too. Nothing is saved until **Save changes**. The page also shows the source details, recent extractions, and, for download-only countries, the upload form, which can mark the month completed after uploading. Admins get **Edit details**.
- **Extract**: country, one month or a date range, trade flow, data set, and a slide-down for specific HS codes. The months start as every due month (or come from the link, e.g. `/extract?country=ZAF&start=2026-07&end=2026-09`). There is a **Catch up** preset. Warnings appear for months that are already completed, waiting to be checked, or probably not published yet. While the service is offline, this page says so and offers **Check again**.
- **Extractions**: what runs on the service now (progress, stop), then previous extractions from the database. Open one for live logs while it runs. After it ends, the page shows its results and next step: mark its months completed, or **Run again** with the same months if it didn't finish.
- **Files**: countries in a sidebar with file counts and sizes. A country shows year tabs over a 12-month board, one card per month with its files and its status. An extracting month has **Mark completed** right on its card. You also get search, a filter for extracted or uploaded files, a "Recent" view, and multi-select to download as one zip, delete or **share**. **Upload files** opens the Upload page. **Share link** (in the selection bar, or a file's menu) makes a link anyone can open at `/s/<id>` without signing in, with an optional password and an expiry (1, 7 or 30 days, or never). Sharing the same files again without a password gives back your existing link instead of a second one. **Shared links** in the sidebar lists every link with its download count, to copy or remove it.
- **Upload** (`/upload?country=`): stores files for any country and month (a file with the same name in that month is replaced). It can mark the month completed. If the country has a direct file link, it can also fetch the month from the source.
- **Settings**: the extraction service URL for this browser (e.g. `http://localhost:3000` when you run it yourself), with a connection test.
- **Admin** (admins only): **Users** (new user, role, password and delete, all from the list) and **Countries** (details and links; add or remove download-only countries). A download-only country needs no extractor. If its source serves each month's Excel/CSV at a predictable address, set its **Direct file link** (e.g. `https://example.gov/trade_{YYYY}{MM}.xlsx`, with `{YYYY}` `{YY}` `{MM}` `{M}`). Its page then offers **Fetch from source**, which downloads that month's file on the server and stores it.

Top right there is only the account button. Its dot shows whether the extraction service is live (checked every 15 seconds). Its menu has the service status, Settings, the light/dark theme and Sign out. Months after the current one can't be marked or extracted.

## Getting started

Requires Node.js 22.13+.

```bash
cp .env.example .env.local   # Supabase URL + anon key, the service_role key, the bucket, the service URL
npm install
npm run dev                  # http://localhost:3001
npm run create-admin -- --username admin --password 'a-long-password'   # first admin, once
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
| `POST /api/auth/sign-in` | **anyone** | `{ username, password }` → session tokens for supabase-js. People sign in with a username. Accounts made here get `{username}@users.invalid` as their Supabase email, which never receives mail. Older accounts with a real email use the part before the `@` |
| `GET /api/me` | all | The signed-in user (username) and role |
| `GET /api/countries` | all | Countries with source, settings, completed and extracting months |
| `POST /api/countries/:code/months` | all | `{ changes: [{ period, status }] }`; `status` is `completed`, `extracting` or `null` (clears) |
| `POST /api/countries` · `PATCH/DELETE /api/countries/:code` | admin | Add a download-only country; edit details; remove a download-only country |
| `GET /api/runs?limit=&country=` · `GET /api/runs/:id` | all | Extraction history |
| `GET /api/files` · `GET /api/files/url?path=` | all | Stored files; a 5-minute signed download link |
| `POST /api/files/zip` · `POST /api/files/delete` | all | `{ paths }` → one zip / delete |
| `POST /api/files/upload` | all | `{ country, period, name }` → a one-time signed upload for any country; the browser uploads straight to Storage |
| `POST /api/countries/:code/fetch` | all | `{ period }` → downloads the month's file from a download-only country's direct file link and stores it |
| `GET /api/shares` · `POST /api/shares` · `DELETE /api/shares/:id` | all | Share links: list; `{ paths, title?, password?, expiresInDays? }` → a new link (`expiresInDays`: 1–365 or `null` for never, default 7); remove a link |
| `GET/POST /api/public/shares/:id` | **anyone** | A link's title and expiry, plus its files once `{ password }` is right (or straight away without one) |
| `POST /api/public/shares/:id/download` | **anyone** | `{ password?, path? }` → `{ url }` for one of the link's files, or all of them as a zip |
| `GET/POST /api/admin/users` · `PATCH/DELETE /api/admin/users/:id` | admin | Accounts |

## Layout

```
src/
├── app/
│   ├── api/          # Server routes (service-role Supabase): me, countries, months, runs, files, admin
│   ├── login/        # Sign-in
│   └── (app)/        # Dashboard, countries/[code], extract, extractions (+ [id]), files, settings, admin
├── server/           # Server-only code for the routes: supabase, http (auth, errors), countries, runs, files, users
├── components/       # Page sections, plus shared pieces: CountryAction (next-step buttons), RunParts (run status,
│                     #   progress, stop, files), ServiceNotice; components/ui/ holds the primitives (Panel, StatTiles…)
└── lib/              # api.ts (this app's API + the extraction service), store.tsx (global state), status.ts (each
                      #   country's next step), runs.ts, months.ts, format.ts, hooks.ts (useAction, useSetMonths…), types
```
