'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';
import { Icon } from './icons';

/**
 * A dialog: a title with an icon, a close button and any body. Escape and the backdrop close it
 * (not while `busy`). Rendered into <body> so a transformed ancestor can't trap the overlay.
 */
export function Modal({
  open,
  onClose,
  title,
  icon,
  danger,
  busy = false,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  danger?: boolean;
  busy?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal-card surface-pop ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-head">
          {icon !== undefined && <div className={`modal-icon-wrap ${danger ? 'modal-icon-danger' : 'modal-icon-neutral'}`}>{icon}</div>}
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Close">
            <Icon.X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** The body: a sentence, or form fields */
  description: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  /** Shown next to the title (a trash can for danger, a lock otherwise) */
  icon?: React.ReactNode;
  confirmDisabled?: boolean;
  loading?: boolean;
}

/** A dialog asking to confirm one action, or to fill in a few fields for it; Enter in a field confirms */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  icon,
  confirmDisabled = false,
  loading = false,
}: ConfirmModalProps) {
  const danger = confirmVariant === 'danger';
  return (
    <Modal open={open} onClose={onClose} title={title} icon={icon ?? (danger ? <Icon.Trash size={18} /> : <Icon.Lock size={18} />)} danger={danger} busy={loading}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirmDisabled && !loading) onConfirm();
        }}
      >
        <div className="modal-body">{description}</div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={loading} disabled={confirmDisabled} className={danger ? 'btn-danger' : ''}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
