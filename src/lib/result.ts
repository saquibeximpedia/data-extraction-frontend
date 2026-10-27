// How server actions and the extraction service report failures to the browser

/** What every server action resolves to: thrown errors are hidden in production, so failures are returned */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

/** A failed call with the message to show */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

/** The message to show for a failed call */
export const errorText = (err: unknown) => (err instanceof AppError ? err.message : 'The server did not respond.');

/** A server action's data, or an AppError. A rejected session goes back to the sign-in page. */
export async function unwrap<T>(pending: Promise<ActionResult<T>>): Promise<T> {
  const result = await pending;
  if (result.ok) return result.data;
  if (result.status === 401 && typeof window !== 'undefined') window.location.assign('/login');
  throw new AppError(result.error, result.status);
}
