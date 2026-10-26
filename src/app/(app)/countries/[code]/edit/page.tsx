'use client';

import { useParams } from 'next/navigation';
import { useCountry } from '@/lib/hooks';
import { CountryEditor } from '@/components/AdminView';
import { PageHead } from '@/components/PageHead';

export default function EditCountryPage() {
  const { code } = useParams<{ code: string }>();
  const name = useCountry(code)?.name ?? code.toUpperCase();
  return (
    <>
      <PageHead back={{ href: `/countries/${code.toUpperCase()}`, label: name }} title={`Edit ${name}`} />
      <CountryEditor code={code} />
    </>
  );
}
