# Trade Data Web App (Next.js)

The app people use: sign-in, countries and their months, extraction history, files, and accounts. Pages are server components that read Supabase directly (service-role key, on the server only); changes go through server actions.

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

## How data moves

- **Sign-in** is the `signIn` server action: it finds the account by username and keeps the Supabase session in cookies. Accounts made here get `{username}@users.invalid` as their Supabase email, which never receives mail; older accounts with a real email use the part before the `@`. `src/proxy.ts` refreshes the session on every request and sends anyone without one to `/login`.
- **Reading**: each page is a server component that checks the session and reads Supabase itself (`modules/*/queries.ts`), so it arrives with its data.
- **Changing**: forms call server actions (`modules/*/actions.ts`). Each checks the session (and role), validates with zod, and refreshes the pages' data. Failures come back as `{ ok: false, error }`.
- **Live**: the browser talks to the extraction service directly (health, live runs, logs, extract, stop). `modules/service/store.tsx` polls it, and refreshes the page's data when an extraction ends.

Two route handlers remain, for what an action can't send back (a file):

| Method & path | Who | Purpose |
|---|---|---|
| `POST /api/files/zip` | signed in | `{ paths }` → the files as one zip |
| `POST /api/public/shares/:id/download` | **anyone** | `{ password?, path? }` → `{ url }` for one of the link's files, or all of them as a zip |

## Layout

Each feature is a module with its own server queries, server actions and components. A component lives in its module when only that module uses it; one shared between modules goes in `src/components`, and primitives in `src/components/ui`.

```
src/
├── proxy.ts                # Session refresh, and the redirect to /login
├── app/                    # Routes only: each page fetches its data and lays out module components
│   ├── (app)/              # Signed-in pages: dashboard, countries, extract, extractions, files, users, settings, service
│   ├── login/ · s/[id]/    # Sign-in; public share links
│   └── api/                # The two file downloads above
├── modules/
│   ├── auth/               # session.ts (current user, requireUser/authorize), actions (sign in/out), setup checks, LoginForm
│   ├── countries/          # queries, actions (months, details), status.ts (each country's next step), table, overview, months editor, form
│   ├── extract/            # The extract form
│   ├── extractions/        # Run history queries; list, detail, live logs, files a run saved
│   ├── files/              # Storage queries, actions (delete, upload, fetch from source); file browser, upload, share modals
│   ├── shares/             # Share link queries and actions; the public share page
│   ├── service/            # The extraction service: client.ts (browser calls), store.tsx (health, live runs), connection page
│   ├── settings/           # Extraction settings on the service
│   └── users/              # Accounts: queries, actions, table
├── components/             # Shared between modules: header, month actions (mark completed / remove), run progress,
│   │                       #   source info, country upload, service notices, step card, skeletons
│   └── ui/                 # Primitives: Button, Panel, Menu, Modal, Select, When (times in the reader's time zone)…
└── lib/                    # Shared helpers: supabase clients, http (errors, validation, throttling), action results,
                            #   format, months, runs, download, hooks, types
```
