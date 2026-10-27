import type { ExportFile } from '@/lib/types';
import { requireUser } from '@/modules/auth/session';
import { countries } from '@/modules/countries/queries';
import { ExtractionDetail } from '@/modules/extractions/components/ExtractionDetail';
import { runs } from '@/modules/extractions/queries';
import { files } from '@/modules/files/queries';

/** The stored files of the countries a run covered (null when storage can't be listed) */
async function filesOf(codes: string[]): Promise<ExportFile[] | null> {
  try {
    return (await Promise.all(codes.map((code) => files.list(code)))).flat();
  } catch {
    return null;
  }
}

/** One extraction: live logs while it runs, its results and next step once it ended */
export default async function ExtractionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [, run, list] = await Promise.all([requireUser(), runs.get(id), countries.list()]);
  const codes = [...new Set(run?.params?.plans?.map((p) => p.countryCode) ?? [])];
  return <ExtractionDetail id={id} stored={run} countries={list} files={await filesOf(codes)} />;
}
