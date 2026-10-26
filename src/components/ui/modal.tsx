'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';
import { Icon } from './icons';

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** The body: a sentence, or form fields */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  /** Shown in the circle next to the title (a trash can for danger, a lock otherwise) */
  icon?: React.ReactNode;
  confirmDisabled?: boolean;
  loading?: boolean;
}

/**
 * A dialog asking to confirm one action, or to fill in a few fields for it. Escape and the
 * backdrop close it (not while it is saving); Enter in a field confirms.
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  icon,
  confirmDisabled = false,
  loading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !loading && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, loading]);

  if (!open) return null;
  const danger = confirmVariant === 'danger';

  // Rendered into <body> so a transformed ancestor (e.g. an animated panel) can't trap the overlay
  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !loading && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <form
        className="modal-card surface-pop"
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirmDisabled && !loading) onConfirm();
        }}
      >
        <div className="modal-head">
          <div className={`modal-icon-wrap ${danger ? 'modal-icon-danger' : 'modal-icon-neutral'}`}>{icon ?? (danger ? <Icon.Trash size={18} /> : <Icon.Lock size={18} />)}</div>
          <div className="modal-title-group">
            <h3 className="modal-title">{title}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={loading} aria-label="Close">
            <Icon.X size={15} />
          </button>
        </div>
        <div className="modal-body">{description}</div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={loading} disabled={confirmDisabled} className={danger ? 'btn-danger' : ''}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
