'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { AdminUser, Country, CountryPatch, Role } from '@/lib/types';
import { fmtDate, fmtRelative, plural } from '@/lib/format';
import { Badge, Button, CodeAvatar, ConfirmModal, Field, Icon, Menu, Segmented, Select, Skeleton, useToast, type MenuItem } from './ui';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

/** Runs an admin action with a busy flag, a toast for the outcome, and `then` on success */
function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(task: () => Promise<T>, ok: string, then?: (result: T) => void) => {
      setBusy(true);
      try {
        const result = await task();
        toast('ok', ok, '');
        then?.(result);
      } catch (err) {
        toast('err', 'Could not save', errorText(err));
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );
  return { busy, run };
}

// ------------------------------------------------------------------ users

/** /admin/users: every account; admins can delete one, change its role or set its password */
export function UsersList() {
  const { me } = useApp();
  const toast = useToast();
  const { busy, run } = useAction();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
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
  ];

  return (
    <section className="panel glass panel-flush reveal" style={{ '--i': 1 } as React.CSSProperties}>
      <div className="panel-head padded">
        <div>
          <h2 className="panel-title">Users</h2>
          <p className="panel-desc">{users ? plural(users.length, 'account') : 'Loading…'}</p>
        </div>
        <Link href="/admin/user/create" className="btn btn-primary btn-sm">
          <Icon.Plus size={14} /> New user
        </Link>
      </div>

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
                <th style={{ width: 150 }} />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="cell-strong">{u.email}</span> {u.id === me?.id && <Badge>You</Badge>}
                  </td>
                  <td>{u.role === 'admin' ? <Badge tone="blue">Admin</Badge> : <Badge>User</Badge>}</td>
                  <td className="cell-sub-color nowrap">{fmtDate(u.createdAt)}</td>
                  <td className="cell-sub-color nowrap">{u.lastSignInAt ? fmtRelative(u.lastSignInAt) : 'Never'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {u.id !== me?.id && (
                      <div className="row-actions">
                        <Button size="sm" variant="ghost" className="btn-danger-ghost" icon={<Icon.Trash size={13} />} onClick={() => setToDelete(u)}>
                          Delete
                        </Button>
                        <Menu items={actions(u)} label={`Manage ${u.email}`} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
        onConfirm={() => toReset && newPassword.length >= 8 && run(() => api.updateUser(toReset.id, { password: newPassword }), `Password changed for ${toReset.email}`, () => setToReset(null))}
        title="Set a new password"
        description={
          <div className="remove-warning">
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
    </section>
  );
}

/** /admin/user/create: a new account that can sign in straight away */
export function CreateUserForm() {
  const router = useRouter();
  const { busy, run } = useAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');

  function create(e: React.FormEvent) {
    e.preventDefault();
    run(() => api.createUser(email.trim(), password, role), `${email.trim()} can sign in now`, () => router.push('/admin/users'));
  }

  return (
    <form className="panel glass reveal admin-form" style={{ '--i': 1 } as React.CSSProperties} onSubmit={create}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">New user</h2>
          <p className="panel-desc">No email is sent; share the password with them directly.</p>
        </div>
      </div>
      <div className="extract-grid">
        <Field label="Email" htmlFor="new-email">
          <input id="new-email" className="control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password (8+ characters)" htmlFor="new-password">
          <input id="new-password" className="control" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
        </Field>
        <Field label="Role">
          <Segmented<Role> label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
        </Field>
      </div>
      <div className="panel-foot">
        <span className="foot-summary">Admins can manage users and country details.</span>
        <Button type="submit" variant="primary" icon={<Icon.Plus size={14} />} loading={busy} disabled={!email || password.length < 8}>
          Create account
        </Button>
      </div>
    </form>
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
});

function CountryFields({ form, set, kind }: { form: CountryPatch; set: (patch: CountryPatch) => void; kind: 'api' | 'manual' }) {
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

  return (
    <>
      <CountryFields form={form} set={(patch) => setForm((f) => ({ ...f, ...patch }))} kind={country.kind} />
      <div className="panel-foot">
        {country.kind === 'manual' ? (
          <Button size="sm" variant="ghost" className="btn-danger-ghost" icon={<Icon.Trash size={13} />} onClick={() => setConfirmDelete(true)}>
            Remove country
          </Button>
        ) : (
          <span className="foot-summary">Built-in source: extraction logic lives in the backend; these fields are what users see.</span>
        )}
        <div className="inline-form">
          <Button size="sm" variant="ghost" onClick={() => setForm(toForm(country))}>
            Reset
          </Button>
          <Button size="sm" variant="primary" loading={busy} onClick={() => run(() => api.updateCountry(country.code, form), `${country.name} saved`, putCountry)}>
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
            router.replace('/admin/country/edit');
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
      router.replace(`/admin/country/edit?code=${created.code}`);
    });
  }

  return (
    <>
      <div className="new-code">
        <Field label="ISO code (3 letters)" htmlFor="new-code">
          <input id="new-code" className="control" maxLength={3} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VNM" />
        </Field>
      </div>
      <CountryFields form={form} set={(patch) => setForm((f) => ({ ...f, ...patch }))} kind="manual" />
      <div className="panel-foot">
        <span className="foot-summary">Users open the source website from the Extract page and upload the files they download.</span>
        <Button size="sm" variant="primary" loading={busy} disabled={code.length !== 3 || !form.name || !form.sourceUrl} onClick={create}>
          Add country
        </Button>
      </div>
    </>
  );
}

/** /admin/country/edit?code=: edit a country's details, or add a download-only country (code=NEW) */
export function CountryAdmin() {
  const { countries } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get('code')?.toUpperCase() ?? countries?.[0]?.code ?? NEW;
  const country = countries?.find((c) => c.code === code);

  if (!countries) {
    return (
      <section className="panel glass">
        <Skeleton height={240} />
      </section>
    );
  }

  return (
    <section className="panel glass reveal" style={{ '--i': 1 } as React.CSSProperties}>
      <div className="panel-head" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2 className="panel-title">{country ? country.name : 'New download-only country'}</h2>
          <p className="panel-desc">
            {country?.updatedAt
              ? `Edited ${fmtRelative(country.updatedAt)}${country.updatedBy ? ` by ${country.updatedBy}` : ''}`
              : country
                ? 'Links and details users see on the Extract page.'
                : 'For sources that publish files (e.g. Excel) instead of an API.'}
          </p>
        </div>
        <div className="country-pick">
          <Select
            id="admin-country"
            value={country ? country.code : NEW}
            onChange={(value) => router.replace(`/admin/country/edit?code=${value}`)}
            options={[
              ...countries.map((c) => ({ value: c.code, label: c.name, meta: c.code, prefix: <CodeAvatar code={c.code} muted={!c.enabled} /> })),
              { value: NEW, label: 'Add download-only country', prefix: <Icon.Plus size={14} /> },
            ]}
          />
        </div>
      </div>
      {country ? <EditCountry key={country.code} country={country} /> : <NewCountry />}
    </section>
  );
}
