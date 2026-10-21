'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from './icons';

type Tone = 'ok' | 'err';
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  detail?: string;
  leaving?: boolean;
}

const ToastContext = createContext<(tone: Tone, title: string, detail?: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Short confirmations for actions whose result isn't otherwise visible on screen */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((tone: Tone, title: string, detail?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, title, detail }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3600);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3900);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast surface-pop ${t.leaving ? 'toast-leaving' : ''}`}>
            <span className={`toast-icon toast-${t.tone}`}>{t.tone === 'ok' ? <Icon.Check size={14} /> : <Icon.Alert size={14} />}</span>
            <span>
              <span className="toast-title">{t.title}</span>
              {t.detail && <span className="toast-detail">{t.detail}</span>}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
