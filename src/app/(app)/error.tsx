'use client';

import { Button, Icon, Panel } from '@/components/ui';

/** A page whose data could not be loaded (e.g. the database is unreachable); the header keeps working */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Panel i={1} title="This page could not load" desc={error.message && !error.digest ? error.message : 'The server ran into a problem loading its data.'}>
      <div className="inline-form">
        <Button variant="primary" icon={<Icon.Refresh size={14} />} onClick={reset}>
          Try again
        </Button>
      </div>
    </Panel>
  );
}
