'use client';

import { useEffect, useState } from 'react';
import { checkService, defaultServiceUrl, savedServiceUrl } from '@/lib/api';
import { useApp } from '@/lib/store';
import { fmtRelative } from '@/lib/format';
import { Badge, Button, Field, Icon, Panel, StatusDot, useToast } from './ui';

const PRESETS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/** Where this browser finds the extraction service; the default comes from NEXT_PUBLIC_EXTRACTION_SERVICE_URL */
export function SettingsView() {
  const { service, setServiceUrl, checkService: recheck, me, isAdmin } = useApp();
  const toast = useToast();
  const fallback = defaultServiceUrl();
  const [saved, setSaved] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);

  // localStorage is only readable in the browser
  useEffect(() => {
    const value = savedServiceUrl();
    setSaved(value);
    setUrl(value ?? fallback);
  }, [fallback]);

  const clean = url.trim().replace(/\/+$/, '');
  const valid = /^https?:\/\/[^\s/]+/i.test(clean);
  const unchanged = clean === (saved ?? fallback);

  /** Says in a toast whether a service answers at the URL in the field */
  async function runTest() {
    setTesting(true);
    const result = await checkService(clean);
    setTesting(false);
    if (result.ok) {
      const h = result.health;
      toast('ok', 'The extraction service answers', `${h.environment ?? 'Unknown'} environment · ${h.countries?.length ?? 0} countries · ${h.running ?? 0} running`);
    } else {
      toast('err', 'No extraction service there', result.error);
    }
  }

  function save() {
    const value = clean === fallback ? null : clean;
    setServiceUrl(value);
    setSaved(value);
    toast('ok', 'Extraction service URL saved', value ? `This browser now uses ${value}` : 'Back to the default');
  }

  function reset() {
    setServiceUrl(null);
    setSaved(null);
    setUrl(fallback);
    toast('ok', 'Back to the default', fallback);
  }

  const health = service.health;

  return (
    <div className="settings-grid">
      <Panel i={1} title="Extraction service" desc="The Node backend that runs extractions. Your browser calls it directly, so one running on this computer works too.">

        <div className={`service-status service-${service.status}`}>
          <StatusDot tone={service.status === 'live' ? 'green' : service.status === 'offline' ? 'red' : undefined} live={service.status === 'live'} />
          <div className="service-status-text">
            <span className="cell-strong">{service.status === 'live' ? 'Live' : service.status === 'offline' ? 'Offline' : 'Checking…'}</span>
            <span className="cell-sub mono">{service.url}</span>
            {service.status === 'offline' && <span className="cell-sub">{service.error}</span>}
          </div>
          <Button size="sm" variant="ghost" icon={<Icon.Refresh size={13} />} onClick={() => recheck()}>
            Check
          </Button>
        </div>

        {service.status === 'live' && health && (
          <dl className="service-facts">
            <div>
              <dt>Environment</dt>
              <dd>{health.environment ?? '—'}</dd>
            </div>
            <div>
              <dt>Running now</dt>
              <dd>{health.running ?? 0}</dd>
            </div>
            <div>
              <dt>Countries</dt>
              <dd>{health.countries?.length ? health.countries.join(', ') : 'None enabled'}</dd>
            </div>
            <div>
              <dt>Up since</dt>
              <dd>{health.startedAt ? fmtRelative(health.startedAt) : '—'}</dd>
            </div>
          </dl>
        )}

        <div className="settings-form">
          <Field
            label="Service URL"
            htmlFor="service-url"
            aside={saved ? <Badge tone="green" dot>Set on this browser</Badge> : <Badge>Default</Badge>}
          >
            <input
              id="service-url"
              className="control mono"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && valid && !unchanged && save()}
              placeholder="http://localhost:3000"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
          <div className="chip-group">
            {[...new Set([fallback, ...PRESETS])].map((p) => (
              <button key={p} type="button" className={`chip-btn ${clean === p ? 'active' : ''}`} onClick={() => setUrl(p)}>
                {p === fallback ? `Default · ${p}` : p}
              </button>
            ))}
          </div>

          <div className="panel-foot">
            <span className="foot-summary">
              Saved in this browser only. The default is <span className="mono">{fallback}</span>
              {process.env.NEXT_PUBLIC_EXTRACTION_SERVICE_URL ? ' (NEXT_PUBLIC_EXTRACTION_SERVICE_URL)' : ''}.
            </span>
            <div className="inline-form">
              {saved && (
                <Button size="sm" variant="ghost" onClick={reset}>
                  Use default
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={<Icon.Plug size={13} />} loading={testing} disabled={!valid} onClick={() => runTest()}>
                Test
              </Button>
              <Button size="sm" variant="primary" disabled={!valid || unchanged} onClick={save}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel i={2} title="Account" desc="Accounts are created by an admin.">
        <dl className="service-facts single">
          <div>
            <dt>Signed in as</dt>
            <dd>{me?.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{isAdmin ? 'Admin' : 'User'}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
