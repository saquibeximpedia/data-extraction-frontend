'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { usePopover, FloatingPanel } from './popover';
import { Icon } from './icons';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  /** Draws a divider above this item */
  separator?: boolean;
  danger?: boolean;
  /** Marks the current item (e.g. the page you are on) */
  active?: boolean;
}

/**
 * Dropdown of actions, e.g. on a table row. Floats above scroll containers.
 * The trigger is a "more" icon unless `trigger` gives its content and class; `header` sits above the items.
 */
export function Menu({
  items,
  label = 'More actions',
  trigger,
  header,
  width = 248,
}: {
  items: MenuItem[];
  label?: string;
  trigger?: { content: React.ReactNode; className: string };
  header?: React.ReactNode;
  width?: number;
}) {
  const { open, setOpen, close, rootRef, triggerRef, panelRef } = usePopover();
  const dismiss = useCallback(() => setOpen(false), [setOpen]);

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={trigger?.className ?? 'btn btn-ghost btn-sm btn-icon'}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger?.content ?? <Icon.More />}
      </button>
      {open && (
        <FloatingPanel anchor={triggerRef.current} panelRef={panelRef} onDismiss={dismiss} width={width} role="menu">
          {header && <div className="menu-header">{header}</div>}
          {items.map((item, i) => {
            const content = (
              <>
                <span className="menu-icon">{item.icon}</span>
                <span className="menu-label">{item.label}</span>
              </>
            );
            const className = `menu-item ${item.danger ? 'menu-item-danger' : ''} ${item.active ? 'menu-item-active' : ''}`;
            return (
              <div key={i}>
                {item.separator && <div className="menu-sep" />}
                {item.href ? (
                  <Link role="menuitem" className={className} href={item.href} aria-current={item.active ? 'page' : undefined} onClick={() => close(false)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    role="menuitem"
                    type="button"
                    className={className}
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
