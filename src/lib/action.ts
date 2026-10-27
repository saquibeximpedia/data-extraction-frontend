import 'server-only';
import { revalidatePath } from 'next/cache';
import { HttpError } from './http';
import type { ActionResult } from './result';

/**
 * The body of a server action. An HttpError comes back as { ok: false, error } (Next hides thrown
 * errors in production); anything else is logged and reported as a 500. A change refreshes every
 * page's server data, so the page that called it re-renders with it.
 */
export async function act<T>(task: () => Promise<T>, { revalidate = true } = {}): Promise<ActionResult<T>> {
  try {
    const data = await task();
    if (revalidate) revalidatePath('/', 'layout');
    return { ok: true, data };
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message, status: err.status };
    console.error('Action failed:', err);
    const message = err instanceof Error && /SUPABASE_SERVICE_ROLE_KEY/.test(err.message) ? err.message : 'Internal server error';
    return { ok: false, error: message, status: 500 };
  }
}
