import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CountryUpload } from '@/components/country-upload';
import { PageHead } from '@/components/page-head';
import { SourceInfo } from '@/components/source-info';
import { Badge, CodeTag, Icon, Panel, When } from '@/components/ui';
import { requireUser } from '@/modules/auth/session';
import { CountryMonths } from '@/modules/countries/components/CountryMonths';
import { CountryOverview, ExtractLink } from '@/modules/countries/components/CountryOverview';
import { RecentRuns } from '@/modules/countries/components/RecentRuns';
import { countries } from '@/modules/countries/queries';
import { runs } from '@/modules/extractions/queries';

/** A country: its next step, numbers, every year's months (editable), source and recent extractions */
export default async function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [me, country, running, recent] = await Promise.all([requireUser(), countries.find(code), runs.running(), runs.list(5, code)]);
  if (!country) notFound();

  return (
    <>
      <PageHead
        title={
          <span className="title-with-code">
            {country.name}
            <CodeTag code={country.code} />
          </span>
        }
        sub={
          <>
            {country.kind === 'manual' && <Badge>Download-only</Badge>}{' '}
            {country.lastUpdatedAt ? (
              <>
                Updated <When value={country.lastUpdatedAt} as="relative" />
              </>
            ) : (
              'Not updated yet'
            )}
          </>
        }
        actions={
          <>
            {me.role === 'admin' && (
              <Link href={`/countries/${country.code}/edit`} className="btn btn-ghost btn-md">
                <Icon.Pencil size={14} /> Edit details
              </Link>
            )}
            <Link href={`/files?country=${country.code}`} className="btn btn-secondary btn-md">
              <Icon.Folder size={14} /> Files
            </Link>
            {country.kind === 'api' && <ExtractLink country={country} running={running} />}
          </>
        }
      />

      <CountryOverview country={country} running={running} />
      <CountryMonths country={country} />

      {country.kind === 'manual' && (
        <Panel
          id="upload"
          i={4}
          title="Upload files"
          desc={
            country.source.fileUrl
              ? 'This source publishes files at a direct link: fetch a month straight from it, or upload files you downloaded.'
              : 'This source publishes files, so nothing is extracted. Download them from the source and keep them here.'
          }
        >
          <CountryUpload country={country} />
        </Panel>
      )}

      <div className="country-bottom">
        <SourceInfo country={country} i={4} />
        {country.kind === 'api' && <RecentRuns code={country.code} runs={recent} />}
      </div>
    </>
  );
}
