'use client';

import { Suspense } from 'react';
import { CountryAdmin } from '@/components/AdminView';

export default function AdminCountryEditPage() {
  return (
    <Suspense>
      <CountryAdmin />
    </Suspense>
  );
}
