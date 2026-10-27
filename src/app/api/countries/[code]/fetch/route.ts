import { z } from 'zod';
import { countries } from '@/server/countries';
import { files } from '@/server/files';
import { badRequest, jsonBody, parse, requireUser, route } from '@/server/http';

const fetchSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM'),
});

/**
 * POST /api/countries/:code/fetch { period } → { path, url, sizeBytes }: downloads the month's file
 * from the country's direct file link and stores it like an upload
 */
export const POST = route<{ params: Promise<{ code: string }> }>(async (req, { params }) => {
  const user = await requireUser(req);
  const body = parse(fetchSchema, await jsonBody(req));
  const country = await countries.get((await params).code);
  if (!country.source.fileUrl) throw badRequest(`${country.name} has no direct file link. An admin can add one under Edit details.`);
  const stored = await files.fetchFromSource(country.code, body.period, country.source.fileUrl, user.username);
  return Response.json(stored, { status: 201 });
});
