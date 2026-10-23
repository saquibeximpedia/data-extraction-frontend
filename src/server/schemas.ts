import { z } from 'zod';

/** POST /api/files/zip and /api/files/delete */
export const filePathsSchema = z.object({
  paths: z.array(z.string().min(1)).min(1, 'Select at least one file').max(500),
});
