import 'server-only';
import { unstable_cache, updateTag } from 'next/cache';

/**
 * What the pages read, cached on the server by kind. Every query uses the service role (no
 * cookies), so one copy serves everyone. Changes made here expire their kind at once (see
 * expireData); changes the extraction service makes show within each kind's few seconds, or at
 * once when the browser sees a run end (refreshData).
 */
export const DATA_TAGS = ['countries', 'runs', 'files', 'shares', 'users'] as const;
export type DataTag = (typeof DATA_TAGS)[number];

/** `fn` cached for `seconds` under the kinds of data it reads (its arguments are part of the key) */
export function cached<A extends unknown[], T>(tags: DataTag[], name: string, seconds: number, fn: (...args: A) => Promise<T>): (...args: A) => Promise<T> {
  return unstable_cache(fn, [...tags, name], { tags, revalidate: seconds });
}

/** Server actions only: the next read of these kinds waits for fresh data (all of them by default) */
export function expireData(tags: readonly DataTag[] = DATA_TAGS): void {
  for (const tag of tags) updateTag(tag);
}
