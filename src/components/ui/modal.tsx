'use client';

import { useEffect, useRef } from 'react';
import { Button } from './index';
import { Icon } from './icons';

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card surface-pop" ref={cardRef}>
        <div className="modal-head">
          <div className="modal-icon-wrap modal-icon-danger">
            <Icon.Trash size={18} />
          </div>
          <div className="modal-title-group">
            <h3 className="modal-title">{title}</h3>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{description}</div>
        <div className="modal-actions">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            onClick={onConfirm}
            className={confirmVariant === 'danger' ? 'btn-danger' : ''}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function formatLogMessage(msg: string) {
  if (msg.includes('no data')) {
    return <span className="log-dim">{msg}</span>;
  }
  if (msg.includes('Saved CSV file') || msg.includes('Extraction completed')) {
    return <span className="log-success">{msg}</span>;
  }
  if (msg.includes('EXPORT:') || msg.includes('IMPORT:')) {
    const parts = msg.split(/(EXPORT: \d+ rows|IMPORT: \d+ rows)/g);
    return (
      <span>
        {parts.map((part, i) =>
          part.match(/(EXPORT|IMPORT): \d+ rows/) ? (
            <span key={i} className="log-success">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  }
  return <span>{msg}</span>;
}
