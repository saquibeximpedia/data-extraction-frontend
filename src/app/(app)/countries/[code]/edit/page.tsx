'use client';

import { useParams } from 'next/navigation';
import { WithCountry } from '@/components/CountryView';
import { MonthEditor } from '@/components/MonthEditor';

export default function EditMonthsPage() {
  const { code } = useParams<{ code: string }>();
  return <WithCountry code={code}>{(country) => <MonthEditor country={country} />}</WithCountry>;
}
