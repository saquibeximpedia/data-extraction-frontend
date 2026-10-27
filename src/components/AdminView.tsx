'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { AdminUser, Country, CountryPatch, Role } from '@/lib/types';
import { fmtDate, fmtMonth, fmtRelative, plural } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { Badge, Button, ConfirmModal, Empty, Field, Icon, LoadingPanel, Menu, Panel, Segmented, Skeleton, useToast, type MenuItem } from './ui';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

// ------------------------------------------------------------------ users

/** "New user": an account that can sign in straight away */
function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { busy, run } = useAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');

  // Each time it opens, it starts empty
  useEffect(() => {
    if (!open) return;
    setEmail('');
    setPassword('');
    setRole('user');
  }, [open]);

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8;

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={() => run(() => api.createUser(email.trim(), password, role), `${email.trim()} can sign in now`, () => (onClose(), onCreated()))}
      title="New user"
      icon={<Icon.Plus size={18} />}
      confirmVariant="primary"
      confirmLabel="Create account"
      confirmDisabled={!valid}
      loading={busy}
      description={
        <div className="modal-form">
          <p className="panel-desc">No email is sent; share the password with them directly.</p>
          <Field label="Email" htmlFor="new-email">
            <input id="new-email" className="control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" autoFocus required />
          </Field>
          <Field label="Password (8+ characters)" htmlFor="new-password">
            <input id="new-password" className="control" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          </Field>
          <Field label="Role">
            <Segmented<Role> label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
          </Field>
          <p className="field-help">Admins can also manage users and country details.</p>
        </div>
      }
    />
  );
}

/** /users: every account; admins can add one, delete one, change its role or set its password */
export function UsersList() {
  const { me } = useApp();
  const toast = useToast();
  const { busy, run } = useAction();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [toReset, setToReset] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(() => {
    api
      .users()
      .then(setUsers)
      .catch((err) => {
        setUsers([]);
        toast('err', 'Could not load users', errorText(err));
      });
  }, [toast]);
  useEffect(load, [load]);

  const actions = (u: AdminUser): MenuItem[] => [
    {
      label: u.role === 'admin' ? 'Make regular user' : 'Make admin',
      icon: <Icon.Lock size={14} />,
      onSelect: () => run(() => api.updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }), `${u.email} is now ${u.role === 'admin' ? 'a user' : 'an admin'}`, load),
    },
    { label: 'Set new password', icon: <Icon.Pencil size={14} />, onSelect: () => (setNewPassword(''), setToReset(u)) },
    { label: 'Delete account', icon: <Icon.Trash size={14} />, separator: true, danger: true, onSelect: () => setToDelete(u) },
  ];

  return (
    <Panel
      i={1}
      flush
      title="Users"
      desc={users ? plural(users.length, 'account') : 'Loading…'}
      actions={
        <Button size="sm" variant="primary" icon={<Icon.Plus size={14} />} onClick={() => setCreating(true)}>
          New user
        </Button>
      }
    >
      {users === null ? (
        <div className="padded">
          <Skeleton height={36} />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th style={{ width: 110 }}>Role</th>
                <th style={{ width: 170 }}>Created</th>
                <th style={{ width: 140 }}>Last sign-in</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="cell-strong">{u.email}</span> {u.id === me?.id && <Badge>You</Badge>}
                  </td>
                  <td>{u.role === 'admin' ? <Badge tone="green" dot>Admin</Badge> : <Badge>User</Badge>}</td>
                  <td className="cell-sub-color nowrap">{fmtDate(u.createdAt)}</td>
                  <td className="cell-sub-color nowrap">{u.lastSignInAt ? fmtRelative(u.lastSignInAt) : 'Never'}</td>
                  <td className="cell-actions">{u.id !== me?.id && <Menu items={actions(u)} label={`Manage ${u.email}`} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
      <ConfirmModal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && run(() => api.deleteUser(toDelete.id), `${toDelete.email} deleted`, () => (setToDelete(null), load()))}
        title="Delete account?"
        description={
          <>
            <b>{toDelete?.email}</b> can no longer sign in. Extractions they started and files stay.
          </>
        }
        confirmLabel="Delete account"
        loading={busy}
      />
      <ConfirmModal
        open={Boolean(toReset)}
        onClose={() => setToReset(null)}
        onConfirm={() => toReset && run(() => api.updateUser(toReset.id, { password: newPassword }), `Password changed for ${toReset.email}`, () => setToReset(null))}
        title="Set a new password"
        confirmDisabled={newPassword.length < 8}
        description={
          <div className="modal-form">
            <span>
              New password for <b>{toReset?.email}</b>. Tell them directly; no email is sent.
            </span>
            <input
              className="control"
              type="password"
              minLength={8}
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />
          </div>
        }
        confirmLabel="Save password"
        confirmVariant="primary"
        loading={busy}
      />
    </Panel>
  );
}

// ------------------------------------------------------------------ countries

const NEW = 'NEW';

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

function EditCountry({ country }: { country: Country }) {
  const { putCountry, refreshCountries } = useApp();
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
          <Button size="sm" variant="primary" loading={busy} disabled={!dirty} onClick={() => run(() => api.updateCountry(country.code, form), `${country.name} saved`, putCountry)}>
            Save changes
          </Button>
        </div>
      </div>
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(() => api.deleteCountry(country.code), `${country.name} removed`, () => {
            setConfirmDelete(false);
            refreshCountries();
            router.replace('/countries');
          })
        }
        title={`Remove ${country.name}?`}
        description="Its details and months are removed. Uploaded files stay in Files until deleted there."
        confirmLabel="Remove country"
        loading={busy}
      />
    </>
  );
}

function NewCountry() {
  const { refreshCountries } = useApp();
  const router = useRouter();
  const { busy, run } = useAction();
  const [code, setCode] = useState('');
  const [form, setForm] = useState<CountryPatch>({ lagMonths: 1, publishDay: 1 });

  function create() {
    const body = { ...form, code: code.trim().toUpperCase(), name: form.name ?? '', sourceUrl: form.sourceUrl ?? '' };
    run(() => api.createCountry(body), `${body.name} added as download-only`, (created) => {
      refreshCountries();
      router.replace(`/countries/${created.code}`);
    });
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
        <span className="foot-summary">Users open the source website from the country's page and upload the files they download there.</span>
        <Button size="sm" variant="primary" loading={busy} disabled={code.length !== 3 || !form.name || !form.sourceUrl} onClick={create}>
          Add country
        </Button>
      </div>
    </>
  );
}

/** /countries/[code]/edit and /countries/new: a country's details, or a new download-only country (admins only) */
export function CountryEditor({ code }: { code: string | null }) {
  const { countries, isAdmin } = useApp();
  const country = code ? countries?.find((c) => c.code === code.toUpperCase()) : undefined;

  if (!isAdmin) {
    return (
      <Panel>
        <Empty>Only admins can edit countries.</Empty>
      </Panel>
    );
  }
  if (!countries) return <LoadingPanel />;
  if (code && !country) {
    return (
      <Panel>
        <Empty>There is no country {code.toUpperCase()}.</Empty>
      </Panel>
    );
  }

  return (
    <Panel
      i={1}
      title={country ? 'Details' : 'New download-only country'}
      desc={
        country?.updatedAt
          ? `Edited ${fmtRelative(country.updatedAt)}${country.updatedBy ? ` by ${country.updatedBy}` : ''}`
          : country
            ? 'Links and details users see on the country page.'
            : 'For sources that publish files (e.g. Excel) instead of an API.'
      }
    >
      {country ? <EditCountry key={country.code} country={country} /> : <NewCountry />}
    </Panel>
  );
}
