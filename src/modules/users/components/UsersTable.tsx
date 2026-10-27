'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, ConfirmModal, Field, Icon, Menu, Panel, Segmented, When, type MenuItem } from '@/components/ui';
import { plural } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { unwrap } from '@/lib/result';
import type { AdminUser, Role } from '@/lib/types';
import { normalizeUsername, USERNAME_RE } from '@/lib/username';
import { createUser, deleteUser, updateUser } from '../actions';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

/** "New user": an account that can sign in straight away */
function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      onConfirm={() => run(() => unwrap(createUser({ username: name, password, role })), `${name} can sign in now`, onClose)}
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

/** Every account; admins can add one, delete one, change its role or set its password */
export function UsersTable({ users, meId }: { users: AdminUser[]; meId: string }) {
  const { busy, run } = useAction();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [toReset, setToReset] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const actions = (u: AdminUser): MenuItem[] => [
    {
      label: u.role === 'admin' ? 'Make regular user' : 'Make admin',
      icon: <Icon.Lock size={14} />,
      onSelect: () => run(() => unwrap(updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })), `${u.username} is now ${u.role === 'admin' ? 'a user' : 'an admin'}`),
    },
    { label: 'Set new password', icon: <Icon.Pencil size={14} />, onSelect: () => (setNewPassword(''), setToReset(u)) },
    { label: 'Delete account', icon: <Icon.Trash size={14} />, separator: true, danger: true, onSelect: () => setToDelete(u) },
  ];

  return (
    <Panel
      i={1}
      flush
      title="Users"
      desc={plural(users.length, 'account')}
      actions={
        <Button size="sm" variant="primary" icon={<Icon.Plus size={14} />} onClick={() => setCreating(true)}>
          New user
        </Button>
      }
    >
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
                  <span className="cell-strong">{u.username}</span> {u.id === meId && <Badge>You</Badge>}
                </td>
                <td>
                  {u.role === 'admin' ? (
                    <Badge tone="green" dot>
                      Admin
                    </Badge>
                  ) : (
                    <Badge>User</Badge>
                  )}
                </td>
                <td className="cell-sub-color nowrap"><When value={u.createdAt} /></td>
                <td className="cell-sub-color nowrap">{u.lastSignInAt ? <When value={u.lastSignInAt} as="relative" /> : 'Never'}</td>
                <td className="cell-actions">{u.id !== meId && <Menu items={actions(u)} label={`Manage ${u.username}`} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
      <ConfirmModal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && run(() => unwrap(deleteUser(toDelete.id)), `${toDelete.username} deleted`, () => setToDelete(null))}
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
        onConfirm={() => toReset && run(() => unwrap(updateUser(toReset.id, { password: newPassword })), `Password changed for ${toReset.username}`, () => setToReset(null))}
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
