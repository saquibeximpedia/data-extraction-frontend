import type { Metadata } from 'next';
import { SharedView } from '@/components/SharedView';

export const metadata: Metadata = { title: 'Shared files', robots: { index: false, follow: false } };

/** /s/{id}: a share link, open to anyone who has it (outside the signed-in pages) */
export default async function SharedPage({ params }: { params: Promise<{ id: string }> }) {
  return <SharedView id={(await params).id} />;
}
