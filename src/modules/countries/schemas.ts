import { z } from 'zod';
import { periodSchema } from '@/lib/schemas';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const sourceUrl = z.url('Enter a full link, e.g. https://example.gov/data');

/** Admin-editable details of a country */
export const countryPatchSchema = z.object({
  name: optionalText(80),
  sourceName: optionalText(120),
  sourceUrl: z.union([sourceUrl, z.literal('')]).optional(),
  endpoint: optionalText(300),
  method: optionalText(500),
  output: optionalText(500),
  notes: optionalText(2000),
  lagMonths: z.number().int().min(0).max(24).optional(),
  publishDay: z.number().int().min(1).max(31).optional(),
  startPeriod: z.union([periodSchema, z.literal('')]).optional(),
  fileUrl: z
    .union([z.string().trim().max(500).regex(/^https?:\/\/\S+$/i, 'Enter a full http(s) link to the file, e.g. https://example.gov/trade_{YYYY}{MM}.xlsx'), z.literal('')])
    .optional(),
});

/** A new download-only country */
export const newCountrySchema = countryPatchSchema.extend({
  code: z.string().trim().regex(/^[A-Za-z]{3}$/, 'Use the 3-letter ISO code, e.g. VNM'),
  name: z.string().trim().min(2, 'Enter the country name').max(80),
  sourceUrl,
});

/** Each month's new status; null clears it */
export const monthChangesSchema = z
  .array(z.object({ period: periodSchema, status: z.enum(['completed', 'extracting']).nullable() }))
  .min(1, 'Nothing to save')
  .max(1200);
