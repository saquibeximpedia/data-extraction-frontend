import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { CardShell } from '@/components/card-shell';
import { callerKeyOf, HttpError } from '@/lib/http';
import { SharedFiles } from '@/modules/shares/components/SharedFiles';
import { shares } from '@/modules/shares/queries';

export const metadata: Metadata = { title: 'Shared files', robots: { index: false, follow: false } };

/** /s/{id}: a share link, open to anyone who has it (outside the signed-in pages) */
export default async function SharedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await shares.open(id, undefined, callerKeyOf(await headers())).catch((err) => {
    if (err instanceof HttpError) return err.message;
    throw err;
  });

  return (
    <CardShell className="shared-body">
      <SharedFiles id={id} share={typeof share === 'string' ? null : share} error={typeof share === 'string' ? share : ''} />
    </CardShell>
  );
}
