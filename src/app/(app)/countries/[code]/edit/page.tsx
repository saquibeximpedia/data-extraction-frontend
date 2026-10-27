import { notFound } from 'next/navigation';
import { Panel, When } from '@/components/ui';
import { requireAdmin } from '@/modules/auth/session';
import { EditCountryForm } from '@/modules/countries/components/CountryForm';
import { countries } from '@/modules/countries/queries';

/** A country's details (admins only) */
export default async function EditCountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await requireAdmin();
  const country = await countries.find(code);
  if (!country) notFound();

  return (
    <Panel
      i={1}
      title={`${country.name} details`}
      desc={
        country.updatedAt ? (
          <>
            Edited <When value={country.updatedAt} as="relative" />
            {country.updatedBy ? ` by ${country.updatedBy}` : ''}
          </>
        ) : (
          'Links and details users see on the country page.'
        )
      }
    >
      <EditCountryForm key={country.code} country={country} />
    </Panel>
  );
}
