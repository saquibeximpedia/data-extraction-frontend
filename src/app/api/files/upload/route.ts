import { z } from 'zod';
import { countries } from '@/server/countries';
import { files } from '@/server/files';
import { jsonBody, parse, requireUser, route } from '@/server/http';

const uploadSchema = z.object({
  country: z.string().regex(/^[A-Za-z]{2,3}$/),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM'),
  name: z.string().trim().min(1).max(200),
});

/**
 * POST /api/files/upload { country, period, name } → { path, token, bucket }: the browser then
 * uploads the file straight to Storage with that one-time token (large files never pass through here)
 */
export const POST = route(async (req) => {
  await requireUser(req);
  const body = parse(uploadSchema, await jsonBody(req));
  const country = await countries.get(body.country);
  return Response.json(await files.uploadTarget(country.code, body.period, body.name), { status: 201 });
});
