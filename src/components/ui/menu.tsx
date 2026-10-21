'use client';

import { useCallback } from 'react';
import { usePopover, FloatingPanel } from './popover';
import { Icon } from './icons';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  /** Draws a divider above this item */
  separator?: boolean;
}

/** "More actions" dropdown, e.g. on a table row. Floats above scroll containers. */
export function Menu({ items, label = 'More actions' }: { items: MenuItem[]; label?: string }) {
  const { open, setOpen, close, rootRef, triggerRef, panelRef } = usePopover();
  const dismiss = useCallback(() => setOpen(false), [setOpen]);

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-sm btn-icon"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon.More />
      </button>
      {open && (
        <FloatingPanel anchor={triggerRef.current} panelRef={panelRef} onDismiss={dismiss} width={248} role="menu">
          {items.map((item, i) => {
            const content = (
              <>
                <span className="menu-icon">{item.icon}</span>
                <span className="menu-label">{item.label}</span>
              </>
            );
            return (
              <div key={i}>
                {item.separator && <div className="menu-sep" />}
                {item.href ? (
                  <a role="menuitem" className="menu-item" href={item.href} onClick={() => close(false)}>
                    {content}
                  </a>
                ) : (
                  <button
                    role="menuitem"
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      item.onSelect?.();
                      close();
                    }}
                  >
                    {content}
                  </button>
                )}
              </div>
            );
          })}
        </FloatingPanel>
      )}
    </div>
  );
}
