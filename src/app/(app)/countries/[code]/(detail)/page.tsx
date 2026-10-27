'use client';

import { useParams } from 'next/navigation';
import { CountryView, WithCountry } from '@/components/CountryView';

export default function CountryPage() {
  const { code } = useParams<{ code: string }>();
  return <WithCountry code={code}>{(country) => <CountryView country={country} />}</WithCountry>;
}
