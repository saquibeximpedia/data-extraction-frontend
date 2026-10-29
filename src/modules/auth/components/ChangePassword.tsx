'use client';

import { useEffect, useState } from 'react';
import { Button, ConfirmModal, Field, Icon } from '@/components/ui';
import { useAction } from '@/lib/hooks';
import { unwrap } from '@/lib/result';
import { changePassword } from '../actions';

/** "Change password": the signed-in person's own, after confirming the current one */
export function ChangePassword() {
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');

  // Each time it opens, it starts empty
  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setRepeat('');
  }, [open]);

  const mismatch = repeat.length > 0 && repeat !== next;
  const valid = current.length > 0 && next.length >= 8 && next === repeat && next !== current;

  return (
    <>
      <Button size="sm" variant="secondary" icon={<Icon.Lock size={14} />} onClick={() => setOpen(true)}>
        Change password
      </Button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => run(() => unwrap(changePassword(current, next)), 'Password changed. Other devices are signed out.', () => setOpen(false), 'Could not change the password')}
        title="Change password"
        confirmVariant="primary"
        confirmLabel="Change password"
        confirmDisabled={!valid}
        loading={busy}
        description={
          <div className="modal-form">
            <Field label="Current password" htmlFor="current-password">
              <input id="current-password" className="control" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus required />
            </Field>
            <Field label="New password (8+ characters)" htmlFor="new-password">
              <input id="new-password" className="control" type="password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
            </Field>
            <Field label="Repeat new password" htmlFor="repeat-password">
              <input id="repeat-password" className="control" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
              {mismatch && <p className="field-help">The passwords don’t match.</p>}
            </Field>
            <p className="field-help">You stay signed in here; other devices are signed out.</p>
          </div>
        }
      />
    </>
  );
}
