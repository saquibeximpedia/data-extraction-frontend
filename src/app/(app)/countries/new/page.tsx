'use client';

import { CountryEditor } from '@/components/AdminView';
import { PageHead } from '@/components/PageHead';

export default function NewCountryPage() {
  return (
    <>
      <PageHead back={{ href: '/countries', label: 'Countries' }} title="Add a country" sub="A download-only country: its files are downloaded from the source by hand." />
      <CountryEditor code={null} />
    </>
  );
}
