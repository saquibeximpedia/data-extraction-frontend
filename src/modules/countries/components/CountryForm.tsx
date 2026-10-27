'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmModal, Field, Icon } from '@/components/ui';
import { fmtMonth } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { unwrap } from '@/lib/result';
import type { Country, CountryPatch } from '@/lib/types';
import { createCountry, deleteCountry, updateCountry } from '../actions';

const toForm = (c: Country): Required<CountryPatch> => ({
  name: c.name,
  sourceName: c.source.name,
  sourceUrl: c.source.url,
  endpoint: c.source.endpoint,
  method: c.source.method,
  output: c.source.output,
  notes: c.notes,
  lagMonths: c.lagMonths,
  publishDay: c.publishDay,
  startPeriod: c.startPeriod ?? '',
  fileUrl: c.source.fileUrl,
});

function CountryFields({
  form,
  set,
  kind,
  defaultStart = null,
}: {
  form: CountryPatch;
  set: (patch: CountryPatch) => void;
  kind: 'api' | 'manual';
  /** The extractor's own start month */
  defaultStart?: string | null;
}) {
  const text = (key: keyof CountryPatch, label: string, opts: { area?: boolean; placeholder?: string; type?: string } = {}) => {
    const props = { id: `f-${key}`, value: String(form[key] ?? ''), placeholder: opts.placeholder, onChange: (e: { target: { value: string } }) => set({ [key]: e.target.value }) };
    return (
      <Field label={label} htmlFor={props.id}>
        {opts.area ? <textarea rows={2} className="control textarea" {...props} /> : <input type={opts.type ?? 'text'} className="control" {...props} />}
      </Field>
    );
  };
  const num = (key: 'lagMonths' | 'publishDay', label: string, min: number, max: number) => (
    <Field label={label} htmlFor={`f-${key}`}>
      <input
        id={`f-${key}`}
        type="number"
        min={min}
        max={max}
        className="control"
        value={form[key] ?? ''}
        onChange={(e) => set({ [key]: e.target.value === '' ? undefined : Number(e.target.value) })}
      />
    </Field>
  );
  return (
    <div className="extract-grid">
      {text('name', 'Country name')}
      {text('sourceName', 'Source name', { placeholder: 'e.g. Statistics office trade portal' })}
      {text('sourceUrl', 'Source website', { type: 'url', placeholder: 'https://…' })}
      {kind === 'api' && text('endpoint', 'Requests (endpoint)')}
      {kind === 'manual' && (
        <div className="span-2">
          <Field label="Direct file link" htmlFor="f-fileUrl" aside={<span className="field-aside">Optional</span>}>
            <input
              id="f-fileUrl"
              type="url"
              className="control mono"
              value={form.fileUrl ?? ''}
              placeholder="https://example.gov/trade/{YYYY}/exports_{YYYY}{MM}.xlsx"
              onChange={(e) => set({ fileUrl: e.target.value })}
            />
            <p className="field-help">
              When the source serves each month&apos;s Excel or CSV at a predictable link, users can fetch it in one click instead of downloading and uploading it. Use{' '}
              {'{YYYY}'}, {'{YY}'}, {'{MM}'} (08) and {'{M}'} (8) for the month.
            </p>
          </Field>
        </div>
      )}
      {num('lagMonths', 'Publication lag (months)', 0, 24)}
      {num('publishDay', 'Usually published on day', 1, 31)}
      <Field label="Data available from" htmlFor="f-startPeriod">
        <input id="f-startPeriod" type="month" className="control" value={form.startPeriod ?? ''} onChange={(e) => set({ startPeriod: e.target.value })} />
        <p className="field-help">
          Earlier months can&apos;t be extracted. {defaultStart ? `Empty uses the default, ${fmtMonth(defaultStart)}.` : 'Empty: no limit.'}
        </p>
      </Field>
      <div className="span-2">{text('method', 'How it is fetched', { area: true })}</div>
      <div className="span-2">{text('output', 'What is saved', { area: true })}</div>
      <div className="span-2">{text('notes', 'Notes for users', { area: true, placeholder: 'e.g. Files are under Statistics > Monthly trade; pick HS 8-digit.' })}</div>
    </div>
  );
}

/** A country's details (admins), with Remove for download-only countries */
export function EditCountryForm({ country }: { country: Country }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [form, setForm] = useState(() => toForm(country));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(country));

  return (
    <>
      <CountryFields form={form} set={(patch) => setForm((f) => ({ ...f, ...patch }))} kind={country.kind} defaultStart={country.defaultStartPeriod} />
      <div className="panel-foot">
        {country.kind === 'manual' ? (
          <Button size="sm" variant="ghost" className="btn-danger-ghost" icon={<Icon.Trash size={13} />} onClick={() => setConfirmDelete(true)}>
            Remove country
          </Button>
        ) : (
          <span className="foot-summary">Extracted by the extraction service; these fields are what users see.</span>
        )}
        <div className="inline-form">
          <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setForm(toForm(country))}>
            Reset
          </Button>
          <Button size="sm" variant="primary" loading={busy} disabled={!dirty} onClick={() => run(() => unwrap(updateCountry(country.code, form)), `${country.name} saved`)}>
            Save changes
          </Button>
        </div>
      </div>
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => run(() => unwrap(deleteCountry(country.code)), `${country.name} removed`, () => router.replace('/countries'))}
        title={`Remove ${country.name}?`}
        description="Its details and months are removed. Uploaded files stay in Files until deleted there."
        confirmLabel="Remove country"
        loading={busy}
      />
    </>
  );
}

/** A new download-only country (admins) */
export function NewCountryForm() {
  const router = useRouter();
  const { busy, run } = useAction();
  const [code, setCode] = useState('');
  const [form, setForm] = useState<CountryPatch>({ lagMonths: 1, publishDay: 1 });

  function create() {
    const body = { ...form, code: code.trim().toUpperCase(), name: form.name ?? '', sourceUrl: form.sourceUrl ?? '' };
    run(() => unwrap(createCountry(body)), `${body.name} added as download-only`, (created) => router.replace(`/countries/${created}`));
  }

  return (
    <>
      <div className="new-code">
        <Field label="ISO code (3 letters)" htmlFor="new-code">
          <input id="new-code" className="control" maxLength={3} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} placeholder="VNM" />
        </Field>
      </div>
      <CountryFields form={form} set={(patch) => setForm((f) => ({ ...f, ...patch }))} kind="manual" />
      <div className="panel-foot">
        <span className="foot-summary">No extraction: users upload the source&apos;s files on the country&apos;s page, or fetch them from the direct file link.</span>
        <Button size="sm" variant="primary" loading={busy} disabled={code.length !== 3 || !form.name || !form.sourceUrl} onClick={create}>
          Add country
        </Button>
      </div>
    </>
  );
}
