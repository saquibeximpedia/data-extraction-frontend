'use server';

import { z } from 'zod';
import { act } from '@/lib/action';
import { badRequest, parse } from '@/lib/http';
import { countryCodeSchema, filePathsSchema, periodSchema } from '@/lib/schemas';
import { authorize } from '@/modules/auth/session';
import { countries } from '@/modules/countries/queries';
import { files } from './queries';

const uploadSchema = z.object({ country: countryCodeSchema, period: periodSchema, name: z.string().trim().min(1).max(200) });

/** A signed link that downloads the file for five minutes */
export async function fileUrl(path: string) {
  return act(
    async () => {
      await authorize();
      return files.signedUrl(path);
    },
    { revalidate: false }
  );
}

/** Removes files from storage (month status is not changed); returns their names */
export async function deleteFiles(paths: string[]) {
  return act(async () => {
    await authorize();
    return files.remove([...new Set(parse(filePathsSchema, paths))]);
  });
}

/**
 * Where to upload a file for a country and month, with a one-time token: the browser uploads
 * straight to Storage, so large files never pass through here. Any country takes uploads.
 */
export async function uploadTarget(input: { country: string; period: string; name: string }) {
  return act(
    async () => {
      const user = await authorize();
      const body = parse(uploadSchema, input);
      const country = await countries.get(body.country);
      return files.uploadTarget(country.code, body.period, body.name, user.username);
    },
    { revalidate: false }
  );
}

/** Downloads the month's file from a download-only country's direct file link and stores it */
export async function fetchFromSource(code: string, period: string) {
  return act(async () => {
    const user = await authorize();
    const country = await countries.get(code);
    if (!country.source.fileUrl) throw badRequest(`${country.name} has no direct file link. An admin can add one under Edit details.`);
    return files.fetchFromSource(country.code, parse(periodSchema, period), country.source.fileUrl, user.username);
  });
}
