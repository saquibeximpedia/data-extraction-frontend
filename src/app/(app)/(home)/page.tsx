import { ServiceNotice, SetupCheck } from '@/components/service-notice';
import { Empty, Panel } from '@/components/ui';
import { requireUser } from '@/modules/auth/session';
import { CountryTable } from '@/modules/countries/components/CountryTable';
import { DashboardStats } from '@/modules/countries/components/DashboardStats';
import { countries } from '@/modules/countries/queries';
import { runs } from '@/modules/extractions/queries';

/** Countries listed on the dashboard (most urgent first); the rest are on the Countries page */
const LIMIT = 8;

/** Headline numbers, then the most urgent countries with their status and where to go next */
export default async function DashboardPage() {
  await requireUser();
  const [list, running] = await Promise.all([countries.list(), runs.running()]);

  return (
    <>
      <ServiceNotice impact="Extracting is unavailable until it runs; months and files still work." />
      {list.length > 0 && <DashboardStats countries={list} running={running} />}
      <SetupCheck
        countries={list}
        fallback={
          list.length === 0 && (
            <Panel i={2}>
              <Empty>No countries yet. Start the extraction service once to publish its countries, or add a download-only country on the Countries page.</Empty>
            </Panel>
          )
        }
      />
      {list.length > 0 && <CountryTable countries={list} running={running} title="Countries" limit={LIMIT} />}
    </>
  );
}
