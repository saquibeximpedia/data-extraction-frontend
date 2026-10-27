'use server';

import { act } from '@/lib/action';
import { authorize } from '@/modules/auth/session';
import { runs } from './queries';

/** One extraction as stored (null when unknown), e.g. how one that just ended finished */
export async function getRun(id: string) {
  return act(
    async () => {
      await authorize();
      return runs.get(id);
    },
    { revalidate: false }
  );
}
