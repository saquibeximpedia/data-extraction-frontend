import { z } from 'zod';
import { normalizeUsername, USERNAME_RE } from '@/lib/username';

const password = z.string().min(8, 'Use at least 8 characters');
const role = z.enum(['admin', 'user']);

export const createUserSchema = z.object({
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(z.string().regex(USERNAME_RE, 'Use 3–32 letters, digits, dots, dashes or underscores, starting with a letter or digit')),
  password,
  role: role.default('user'),
});

export const updateUserSchema = z.object({ password: password.optional(), role: role.optional() });
