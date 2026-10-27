'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { errorText, extractor, type SettingsResponse } from '@/lib/api';
import { useApp } from '@/lib/store';
import { useAction } from '@/lib/hooks';
import type { AppSettings } from '@/lib/types';
import { Badge, Button, Field, NumberInput, Panel } from './ui';

/** How extractions run (threads, retries, file size) beside the signed-in account. The service's address and status are on /service. */
export function SettingsView() {
  const { me, isAdmin } = useApp();
  return (
    <div className="settings-grid">
      <ExtractionSettings />
      <Panel i={2} title="Account" desc="Accounts are created by an admin.">
        <dl className="service-facts single">
          <div>
            <dt>Signed in as</dt>
            <dd>{me?.username}</dd>
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

/** The settings on the page, shown in friendlier units (seconds for the retry delay) */
const SETTING_FIELDS: { key: keyof AppSettings; label: string; help: string; unit?: string; min: number; max: number; scale?: number }[] = [
  { key: 'maxConcurrentPerCountry', label: 'Parallel requests per country', help: 'Threads for one country. A country whose source sets its own limit keeps it.', unit: 'at once', min: 1, max: 20 },
  { key: 'maxConcurrentExtractions', label: 'Parallel requests overall', help: 'Cap across every extraction running at the same time.', unit: 'at once', min: 1, max: 50 },
  { key: 'retryMaxAttempts', label: 'Retries', help: 'For timeouts, rate limits and server errors.', unit: 'times', min: 0, max: 10 },
  { key: 'retryDelayMs', label: 'First retry after', help: 'Doubles with each retry.', unit: 'sec', min: 1, max: 60, scale: 1000 },
  { key: 'emptyStreakFlagAt', label: 'Flag after empty requests', help: 'Requests in a row with 0 records before a run is flagged.', unit: 'requests', min: 10, max: 100000 },
  { key: 'maxUploadMb', label: 'Split files larger than', help: 'A bigger month is saved in parts. Keep it under your storage plan’s file limit.', unit: 'MB', min: 1, max: 500 },
];

const toForm = (s: AppSettings) => Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, String(Math.round(s[f.key] / (f.scale ?? 1)))])) as Record<keyof AppSettings, string>;

/**
 * How extractions run on the service: threads, retries, flags and file size. Changes apply from
 * the next request without a restart. Everyone sees them; admins change them.
 */
function ExtractionSettings() {
  const { serviceLive, isAdmin } = useApp();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<Record<keyof AppSettings, string> | null>(null);
  const [error, setError] = useState('');
  const { busy, run } = useAction();

  useEffect(() => {
    if (!serviceLive) return;
    extractor.settings().then(
      (r) => {
        setData(r);
        setForm(toForm(r.settings));
        setError('');
      },
      (err) => setError(errorText(err))
    );
  }, [serviceLive]);

  const desc = 'How extractions run: threads, retries and file size. Changes apply to new requests straight away.';
  if (!serviceLive || error || !data || !form) {
    return (
      <Panel i={1} title="Extraction settings" desc={desc}>
        <p className="foot-summary">
          {!serviceLive ? <>Available while the extraction service is live. <Link href="/service" className="link">Connection</Link></> : error ? `This service does not offer settings yet (${error}). Update and restart it.` : 'Loading…'}
        </p>
      </Panel>
    );
  }

  const parsed = SETTING_FIELDS.map((f) => ({ f, n: Number(form[f.key]) }));
  const invalid = parsed.some(({ f, n }) => form[f.key] === '' || n < f.min || n > f.max);
  const changed = SETTING_FIELDS.filter((f) => form[f.key] !== toForm(data.settings)[f.key]);
  const atDefaults = SETTING_FIELDS.every((f) => form[f.key] === toForm(data.defaults)[f.key]);

  function save() {
    const patch = Object.fromEntries(parsed.map(({ f, n }) => [f.key, n * (f.scale ?? 1)])) as Partial<AppSettings>;
    run(() => extractor.saveSettings(patch), 'Extraction settings saved', (r) => {
      setData(r);
      setForm(toForm(r.settings));
    }, 'Could not save the settings');
  }

  return (
    <Panel i={1} title="Extraction settings" desc={desc} actions={!isAdmin && <Badge>Admins can change these</Badge>}>
      <div className="settings-fields">
        {SETTING_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`set-${f.key}`}>
            <NumberInput
              id={`set-${f.key}`}
              value={form[f.key]}
              onChange={(v) => setForm({ ...form, [f.key]: v })}
              unit={f.unit}
              min={f.min}
              max={f.max}
              disabled={!isAdmin}
            />
            <p className="field-help">
              {f.help} {f.min}–{f.max.toLocaleString()}.
            </p>
          </Field>
        ))}
      </div>
      {isAdmin && (
        <div className="panel-foot">
          <span className="foot-summary">{invalid ? 'Some values are out of range.' : changed.length ? `${changed.length} unsaved ${changed.length === 1 ? 'change' : 'changes'}` : 'Saved on the service, kept across restarts.'}</span>
          <div className="inline-form">
            {!atDefaults && (
              <Button size="sm" variant="ghost" onClick={() => setForm(toForm(data.defaults))}>
                Reset to .env defaults
              </Button>
            )}
            {changed.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setForm(toForm(data.settings))}>
                Discard
              </Button>
            )}
            <Button size="sm" variant="primary" disabled={invalid || !changed.length} loading={busy} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
