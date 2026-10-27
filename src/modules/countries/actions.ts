'use server';

import { act } from '@/lib/action';
import { parse } from '@/lib/http';
import type { CountryPatch, MonthChange } from '@/lib/types';
import { authorize, authorizeAdmin } from '@/modules/auth/session';
import { countries } from './queries';
import { countryPatchSchema, monthChangesSchema, newCountrySchema } from './schemas';

/** Sets each month's status ('completed' or 'extracting'; null clears it, files are kept); returns how many changed */
export async function setMonths(code: string, changes: MonthChange[]) {
  return act(async () => {
    const user = await authorize();
    return countries.setMonths(code, parse(monthChangesSchema, changes), user.username);
  });
}

/** Admin: edits name, source links and text, notes, lag, publish day, start month */
export async function updateCountry(code: string, patch: CountryPatch) {
  return act(async () => {
    const user = await authorizeAdmin();
    await countries.update(code, parse(countryPatchSchema, patch), user.username);
  });
}

/** Admin: adds a download-only country; returns its code */
export async function createCountry(input: CountryPatch & { code: string }) {
  return act(async () => {
    const user = await authorizeAdmin();
    return countries.createManual(parse(newCountrySchema, input), user.username);
  });
}

/** Admin: removes a download-only country */
export async function deleteCountry(code: string) {
  return act(async () => {
    await authorizeAdmin();
    await countries.removeManual(code);
  });
}
