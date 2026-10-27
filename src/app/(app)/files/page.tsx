import { requireUser } from '@/modules/auth/session';
import { countries } from '@/modules/countries/queries';
import { FilesBrowser } from '@/modules/files/components/FilesBrowser';
import { files } from '@/modules/files/queries';
import { shares } from '@/modules/shares/queries';

type Params = { country?: string; view?: string };

/** A result, or the message of why it failed (the page still shows the rest) */
const settle = <T,>(pending: Promise<T>, fallback: T) => pending.then((data) => ({ data, error: '' }), (err: Error) => ({ data: fallback, error: err.message }));

/** Stored files by country and month, recent files and share links: /files?country=ZAF or /files?view=shares */
export default async function FilesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [, params, stored, list, links] = await Promise.all([requireUser(), searchParams, settle(files.list(), []), countries.list(), settle(shares.list(), [])]);
  return (
    <FilesBrowser
      // A link to another view (e.g. from a toast) starts the page over there
      key={`${params.country}|${params.view}`}
      files={stored.data}
      filesError={stored.error}
      countries={list}
      shares={links.data}
      sharesError={links.error}
      params={params}
    />
  );
}
