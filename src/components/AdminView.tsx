'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { AdminUser, Country, CountryPatch, Role } from '@/lib/types';
import { fmtDate, fmtRelative } from '@/lib/format';
import { Badge, Button, CodeAvatar, ConfirmModal, Field, Icon, Menu, Segmented, Skeleton, useToast, type MenuItem } from './ui';

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'The API server did not respond.');

// ------------------------------------------------------------------ users

function UsersPanel() {
  const { me } = useApp();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [toReset, setToReset] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [working, setWorking] = useState(false);

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const user = await api.createUser(email.trim(), password, role);
      toast('ok', 'Account created', `${user.email} can sign in now`);
      setEmail('');
      setPassword('');
      setRole('user');
      load();
    } catch (err) {
      toast('err', 'Could not create the account', errorText(err));
    } finally {
      setCreating(false);
    }
  }

  async function run(task: () => Promise<unknown>, ok: string, done: () => void) {
    setWorking(true);
    try {
      await task();
      toast('ok', ok, '');
      done();
      load();
    } catch (err) {
      toast('err', 'Could not save', errorText(err));
    } finally {
      setWorking(false);
    }
  }

  const actions = (u: AdminUser): MenuItem[] => [
    {
      label: u.role === 'admin' ? 'Make regular user' : 'Make admin',
      icon: <Icon.Lock size={14} />,
      onSelect: () => run(() => api.updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }), `${u.email} is now ${u.role === 'admin' ? 'a user' : 'an admin'}`, () => {}),
    },
    { label: 'Set new password', icon: <Icon.Pencil size={14} />, onSelect: () => (setNewPassword(''), setToReset(u)) },
    { label: 'Delete account', icon: <Icon.Trash size={14} />, separator: true, onSelect: () => setToDelete(u) },
  ];

  return (
    <section className="panel glass panel-flush reveal" style={{ '--i': 1 } as React.CSSProperties}>
      <div className="panel-head padded">
        <div>
          <h2 className="panel-title">Users</h2>
          <p className="panel-desc">Accounts sign in with email and password. Admins can manage users and country details.</p>
        </div>
      </div>

      <form className="add-month padded" onSubmit={create}>
        <div className="inline-form">
          <input className="control note-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email" />
          <input
            className="control note-input"
            type="password"
            placeholder="Password (8+ characters)"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-label="Password"
            autoComplete="new-password"
          />
          <div className="role-pick">
            <Segmented<Role>
              label="Role"
              value={role}
              onChange={setRole}
              options={[
                { value: 'user', label: 'User' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>
          <Button type="submit" variant="primary" size="sm" icon={<Icon.Plus size={14} />} loading={creating} disabled={!email || password.length < 8}>
            Create account
          </Button>
        </div>
      </form>

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
                <th style={{ width: 150 }}>Created</th>
                <th style={{ width: 150 }}>Last sign-in</th>
                <th style={{ width: 60 }} />
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
                  <td style={{ textAlign: 'right' }}>{u.id !== me?.id && <Menu items={actions(u)} label={`Manage ${u.email}`} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && run(() => api.deleteUser(toDelete.id), `${toDelete.email} deleted`, () => setToDelete(null))}
        title="Delete account?"
        description={
          <>
            <b>{toDelete?.email}</b> can no longer sign in. Extractions they started and files stay.
          </>
        }
        confirmLabel="Delete account"
        loading={working}
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
        loading={working}
      />
    </section>
  );
}

// ------------------------------------------------------------------ countries

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
  const text = (key: keyof CountryPatch, label: string, opts: { area?: boolean; placeholder?: string; type?: string } = {}) => (
    <Field label={label} htmlFor={`f-${key}`}>
      {opts.area ? (
        <textarea id={`f-${key}`} rows={2} className="control textarea" value={String(form[key] ?? '')} placeholder={opts.placeholder} onChange={(e) => set({ [key]: e.target.value })} />
      ) : (
        <input id={`f-${key}`} type={opts.type ?? 'text'} className="control" value={String(form[key] ?? '')} placeholder={opts.placeholder} onChange={(e) => set({ [key]: e.target.value })} />
      )}
    </Field>
  );
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

function CountryEditor({ country, onDeleted }: { country: Country; onDeleted: () => void }) {
  const { putCountry } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(country));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setForm(toForm(country)), [country]);

  async function save() {
    setSaving(true);
    try {
      putCountry(await api.updateCountry(country.code, form));
      toast('ok', 'Saved', country.name);
      setOpen(false);
    } catch (err) {
      toast('err', 'Could not save', errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api.deleteCountry(country.code);
      toast('ok', 'Country removed', country.name);
      setConfirmDelete(false);
      onDeleted();
    } catch (err) {
      toast('err', 'Could not remove', errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="country-edit">
      <button type="button" className="country-edit-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`group-chevron ${open ? '' : 'closed'}`}>
          <Icon.ChevronDown />
        </span>
        <CodeAvatar code={country.code} muted={!country.enabled} />
        <span className="cell-strong">{country.name}</span>
        {country.kind === 'manual' ? <Badge tone="blue">Download-only</Badge> : <Badge>Extracted</Badge>}
        <span className="cell-sub-color country-edit-url">{country.source.url}</span>
        {country.updatedAt && <span className="cell-sub">edited {fmtRelative(country.updatedAt)}{country.updatedBy ? ` by ${country.updatedBy}` : ''}</span>}
      </button>
      {open && (
        <div className="country-edit-body">
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
              <Button size="sm" variant="ghost" onClick={() => (setForm(toForm(country)), setOpen(false))}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" loading={saving} onClick={save}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title={`Remove ${country.name}?`}
        description="Its details and completed months are removed. Uploaded files stay in Files until deleted there."
        confirmLabel="Remove country"
        loading={saving}
      />
    </div>
  );
}

function CountriesPanel() {
  const { countries, refreshCountries } = useApp();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [form, setForm] = useState<CountryPatch>({ lagMonths: 1, publishDay: 1 });
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    try {
      const created = await api.createCountry({ ...form, code: code.trim().toUpperCase(), name: form.name ?? '', sourceUrl: form.sourceUrl ?? '' });
      toast('ok', 'Country added', `${created.name} is download-only`);
      setAdding(false);
      setCode('');
      setForm({ lagMonths: 1, publishDay: 1 });
      refreshCountries();
    } catch (err) {
      toast('err', 'Could not add the country', errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel glass panel-flush reveal" style={{ '--i': 2 } as React.CSSProperties}>
      <div className="panel-head padded" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2 className="panel-title">Countries</h2>
          <p className="panel-desc">Edit links and details users see. Add download-only countries for sources that publish files (e.g. Excel).</p>
        </div>
        {!adding && (
          <Button size="sm" variant="secondary" icon={<Icon.Plus size={14} />} onClick={() => setAdding(true)}>
            Add download-only country
          </Button>
        )}
      </div>

      {adding && (
        <div className="country-edit-body add-month">
          <Field label="ISO code (3 letters)" htmlFor="new-code">
            <input id="new-code" className="control lag-input" maxLength={3} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VNM" />
          </Field>
          <CountryFields form={form} set={(patch) => setForm((f) => ({ ...f, ...patch }))} kind="manual" />
          <div className="panel-foot">
            <span className="foot-summary">Users open the source website from the Extract page and upload the files they download.</span>
            <div className="inline-form">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" loading={saving} disabled={code.length !== 3 || !form.name || !form.sourceUrl} onClick={create}>
                Add country
              </Button>
            </div>
          </div>
        </div>
      )}

      {countries === null ? (
        <div className="padded">
          <Skeleton height={36} />
        </div>
      ) : (
        countries.map((c) => <CountryEditor key={c.code} country={c} onDeleted={refreshCountries} />)
      )}
    </section>
  );
}

export function AdminView() {
  const { isAdmin } = useApp();
  if (!isAdmin) return <p className="empty">Only admins can open this page.</p>;
  return (
    <>
      <UsersPanel />
      <CountriesPanel />
    </>
  );
}
