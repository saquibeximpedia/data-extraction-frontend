'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from './icons';

type Tone = 'ok' | 'err';

/** A button on the toast, e.g. "Undo" or "Open" */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  detail?: string;
  action?: ToastAction;
  leaving?: boolean;
}

type Show = (tone: Tone, title: string, detail?: string, action?: ToastAction) => void;

const ToastContext = createContext<Show>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Short confirmations for actions whose result isn't otherwise visible on screen; ones with an action stay longer */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 300);
  }, []);

  const show = useCallback<Show>(
    (tone, title, detail, action) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, tone, title, detail, action }]);
      setTimeout(() => dismiss(id), action ? 7000 : 3600);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast surface-pop ${t.leaving ? 'toast-leaving' : ''}`}>
            <span className={`toast-icon toast-${t.tone}`}>{t.tone === 'ok' ? <Icon.Check size={14} /> : <Icon.Alert size={14} />}</span>
            <span className="toast-text">
              <span className="toast-title">{t.title}</span>
              {t.detail && <span className="toast-detail">{t.detail}</span>}
            </span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
