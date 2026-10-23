import { requireUser, route } from '@/server/http';

/** GET /api/me → the signed-in user and role (sign-in itself happens in the browser with Supabase) */
export const GET = route(async (req) => Response.json(await requireUser(req)));
