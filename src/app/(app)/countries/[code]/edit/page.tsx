'use client';

import { useParams } from 'next/navigation';
import { CountryEditor } from '@/components/AdminView';

export default function EditCountryPage() {
  const { code } = useParams<{ code: string }>();
  return <CountryEditor code={code} />;
}
