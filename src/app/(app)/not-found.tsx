import Link from 'next/link';
import { Empty, Panel } from '@/components/ui';

/** A country or extraction that doesn't exist, inside the signed-in pages */
export default function NotFound() {
  return (
    <Panel>
      <Empty>
        This page doesn&apos;t exist (anymore).{' '}
        <Link href="/" className="link">
          Back to the dashboard
        </Link>
      </Empty>
    </Panel>
  );
}
