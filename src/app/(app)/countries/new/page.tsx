import { Panel } from '@/components/ui';
import { requireAdmin } from '@/modules/auth/session';
import { NewCountryForm } from '@/modules/countries/components/CountryForm';

/** A new download-only country (admins only) */
export default async function NewCountryPage() {
  await requireAdmin();
  return (
    <Panel i={1} title="New download-only country" desc="For sources that publish files (Excel or CSV) instead of an API. Nothing is extracted; files are uploaded or fetched from a direct link.">
      <NewCountryForm />
    </Panel>
  );
}
