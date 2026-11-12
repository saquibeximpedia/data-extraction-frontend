'use server';

import { authorize } from '@/modules/auth/session';
import { act } from './action';

/**
 * Drops the server's cached data, for changes made outside this app's actions: an extraction that
 * ended, files the browser uploaded straight to Storage, or a Refresh click.
 */
export async function refreshData() {
  return act(async () => {
    await authorize();
  });
}
