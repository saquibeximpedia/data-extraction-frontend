import { z } from 'zod';

/** A month, "YYYY-MM" */
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

/** A country code in a request */
export const countryCodeSchema = z.string().regex(/^[A-Za-z]{2,3}$/, 'Use the country code');

/** Selected files, e.g. to zip, delete or share */
export const filePathsSchema = z.array(z.string().min(1)).min(1, 'Select at least one file').max(500);
