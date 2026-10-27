import Link from 'next/link';
import { Empty, Icon, Panel } from '@/components/ui';
import { requireUser } from '@/modules/auth/session';
import { CountryTable } from '@/modules/countries/components/CountryTable';
import { countries } from '@/modules/countries/queries';
import { runs } from '@/modules/extractions/queries';

/** Every country in the dashboard's table, without the limit. Admins can add countries. */
export default async function CountriesPage() {
  const [me, list, running] = await Promise.all([requireUser(), countries.list(), runs.running()]);

  if (!list.length) {
    return (
      <Panel i={1}>
        <Empty>No countries yet.</Empty>
      </Panel>
    );
  }
  return (
    <CountryTable
      countries={list}
      running={running}
      i={1}
      lead={
        me.role === 'admin' && (
          <Link href="/countries/new" className="btn btn-secondary btn-sm">
            <Icon.Plus size={14} /> Add country
          </Link>
        )
      }
    />
  );
}
