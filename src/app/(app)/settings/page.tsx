import { Panel } from '@/components/ui';
import { requireUser } from '@/modules/auth/session';
import { ExtractionSettings } from '@/modules/settings/components/ExtractionSettings';

/** How extractions run (threads, retries, file size) beside the signed-in account. The service's address and status are on /service. */
export default async function SettingsPage() {
  const me = await requireUser();
  return (
    <div className="settings-grid">
      <ExtractionSettings />
      <Panel i={2} title="Account" desc="Accounts are created by an admin.">
        <dl className="service-facts single">
          <div>
            <dt>Signed in as</dt>
            <dd>{me.username}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{me.role === 'admin' ? 'Admin' : 'User'}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
