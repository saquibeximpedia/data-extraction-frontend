import { requireUser } from '@/modules/auth/session';
import { countries } from '@/modules/countries/queries';
import { ExtractPanel } from '@/modules/extract/components/ExtractPanel';

type Params = { country?: string; start?: string; end?: string };

/** New extraction: /extract?country=ZAF&start=2026-07&end=2026-09 fills in the country and months */
export default async function ExtractPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [, list, requested] = await Promise.all([requireUser(), countries.list(), searchParams]);
  // Each country starts from its own months, so a new link starts the form over
  return <ExtractPanel key={`${requested.country}|${requested.start}|${requested.end}`} countries={list} requested={requested} />;
}
