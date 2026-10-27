'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { AdminUser, Country, CountryPatch, Role } from '@/lib/types';
import { fmtDate, fmtMonth, fmtRelative, plural } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { normalizeUsername, USERNAME_RE } from '@/lib/username';
import { FormPageSkeleton, TableRowsSkeleton } from './PageSkeletons';
import { Badge, Button, ConfirmModal, Empty, Field, Icon, Menu, Panel, Segmented, useToast, type MenuItem } from './ui';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

// ------------------------------------------------------------------ users

/** "New user": an account that can sign in straight away */
function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { busy, run } = useAction();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');

  // Each time it opens, it starts empty
  useEffect(() => {
    if (!open) return;
    setUsername('');
    setPassword('');
    setRole('user');
  }, [open]);

  const name = normalizeUsername(username);
  const valid = USERNAME_RE.test(name) && password.length >= 8;

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={() => run(() => api.createUser(name, password, role), `${name} can sign in now`, () => (onClose(), onCreated()))}
      title="New user"
      icon={<Icon.Plus size={18} />}
      confirmVariant="primary"
      confirmLabel="Create account"
      confirmDisabled={!valid}
      loading={busy}
      description={
        <div className="modal-form">
          <p className="panel-desc">They sign in with this username and password. Share the password with them directly.</p>
          <Field label="Username" htmlFor="new-username">
            <input
              id="new-username"
              className="control"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. john.smith"
              autoFocus
              required
            />
            <p className="field-help">3–32 characters: letters, digits, dots, dashes or underscores.</p>
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
      onSelect: () => run(() => api.updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }), `${u.username} is now ${u.role === 'admin' ? 'a user' : 'an admin'}`, load),
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
        <TableRowsSkeleton rows={4} cols={[1, 0.4, 0.6, 0.5, 0.2]} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
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
                    <span className="cell-strong">{u.username}</span> {u.id === me?.id && <Badge>You</Badge>}
                  </td>
                  <td>{u.role === 'admin' ? <Badge tone="green" dot>Admin</Badge> : <Badge>User</Badge>}</td>
                  <td className="cell-sub-color nowrap">{fmtDate(u.createdAt)}</td>
                  <td className="cell-sub-color nowrap">{u.lastSignInAt ? fmtRelative(u.lastSignInAt) : 'Never'}</td>
                  <td className="cell-actions">{u.id !== me?.id && <Menu items={actions(u)} label={`Manage ${u.username}`} />}</td>
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
        onConfirm={() => toDelete && run(() => api.deleteUser(toDelete.id), `${toDelete.username} deleted`, () => (setToDelete(null), load()))}
        title="Delete account?"
        description={
          <>
            <b>{toDelete?.username}</b> can no longer sign in. Extractions they started and files stay.
          </>
        }
        confirmLabel="Delete account"
        loading={busy}
      />
      <ConfirmModal
        open={Boolean(toReset)}
        onClose={() => setToReset(null)}
        onConfirm={() => toReset && run(() => api.updateUser(toReset.id, { password: newPassword }), `Password changed for ${toReset.username}`, () => setToReset(null))}
        title="Set a new password"
        confirmDisabled={newPassword.length < 8}
        description={
          <div className="modal-form">
            <span>
              New password for <b>{toReset?.username}</b>. Tell them directly; no email is sent.
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
              When the source serves each month&apos;s Excel or CSV at a predictable link, users can fetch it in one click instead of downloading and uploading it. Use {'{YYYY}'}, {'{YY}'}, {'{MM}'} (08) and {'{M}'} (8) for the month.
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
        <span className="foot-summary">No extraction: users upload the source's files on the country's page, or fetch them from the direct file link.</span>
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
  if (!countries) return <FormPageSkeleton />;
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
      title={country ? `${country.name} details` : 'New download-only country'}
      desc={
        country?.updatedAt
          ? `Edited ${fmtRelative(country.updatedAt)}${country.updatedBy ? ` by ${country.updatedBy}` : ''}`
          : country
            ? 'Links and details users see on the country page.'
            : 'For sources that publish files (Excel or CSV) instead of an API. Nothing is extracted; files are uploaded or fetched from a direct link.'
      }
    >
      {country ? <EditCountry key={country.code} country={country} /> : <NewCountry />}
    </Panel>
  );
}
