'use client';

import { Suspense } from 'react';
import { CountryAdmin } from '@/components/AdminView';

export default function AdminCountriesPage() {
  return (
    <Suspense>
      <CountryAdmin />
    </Suspense>
  );
}
