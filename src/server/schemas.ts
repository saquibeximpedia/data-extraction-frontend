import { z } from 'zod';

/** POST /api/files/zip and /api/files/delete */
export const filePathsSchema = z.object({
  paths: z.array(z.string().min(1)).min(1, 'Select at least one file').max(500),
});

/** POST /api/shares */
export const createShareSchema = z.object({
  paths: z.array(z.string().min(1)).min(1, 'Select at least one file').max(500),
  title: z.string().trim().max(120).optional(),
  // Empty or missing: anyone with the link can download
  password: z.string().max(200).optional().transform((v) => v || undefined).pipe(z.string().min(4, 'Use a password of at least 4 characters').optional()),
  // null: never expires
  expiresInDays: z.number().int().min(1).max(365).nullable().default(7),
});

/** POST /api/public/shares/:id and .../download */
export const shareAccessSchema = z.object({
  password: z.string().max(200).optional(),
  path: z.string().min(1).optional(),
});
