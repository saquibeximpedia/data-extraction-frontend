import { requireUser } from '@/modules/auth/session';
import { ExtractionsList } from '@/modules/extractions/components/ExtractionsList';
import { runs } from '@/modules/extractions/queries';

/** What runs now on the service, then the latest extractions from the database */
export default async function ExtractionsPage() {
  await requireUser();
  return <ExtractionsList history={await runs.list(50)} />;
}
