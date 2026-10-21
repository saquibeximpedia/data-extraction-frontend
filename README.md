# Data Extraction Web UI (Next.js)

Frontend for the [data-extraction](https://github.com/saquibeximpedia/data-extraction) API. Pages: Overview, Runs, Files.

The browser calls the Express API directly (the API allows cross-origin requests), so the API sees each browser's real IP for its `ALLOWED_IPS` check.

## Getting started

Requires Node.js 22.13+ and the backend running (default `http://localhost:3000`).

```bash
npm install
npm run dev        # UI on http://localhost:3001
```

By default the UI expects the API on the same host it was opened from, port 3000, so opening `http://<server-ip>:3001` from another machine works as long as that machine's IP is in the API's `ALLOWED_IPS`. Set `NEXT_PUBLIC_API_URL` in `.env.local` to point elsewhere (rebuild after changing it; see `.env.example`).

For production: `npm run build && npm run start`.

## Layout

```
src/
├── app/             # login/ and (app)/ pages: Overview, Runs, Files
├── components/      # Page sections; components/ui/ holds the primitives
└── lib/             # store.tsx (global state), api.ts, types.ts
```
