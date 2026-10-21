'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Open/close state for a trigger + floating panel pair.
 * Closes on outside click and Escape, and returns focus to the trigger.
 */
export function usePopover<T extends HTMLElement = HTMLButtonElement>() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<T>(null);
  // Set when the panel is portalled outside the root
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return { open, setOpen, close, rootRef, triggerRef, panelRef };
}

/** The floating panel; place inside a `.popover-root` wrapper next to the trigger */
export function PopoverPanel({
  align = 'start',
  width,
  children,
  style,
  ...rest
}: { align?: 'start' | 'end'; width?: number | string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`popover surface-pop popover-${align}`} style={{ width, ...style }} {...rest}>
      {children}
    </div>
  );
}

/**
 * Same panel, rendered into <body> at a fixed position under the trigger.
 * Use inside scroll containers (tables) that would otherwise clip it.
 * Closes on scroll or resize, since it no longer moves with the trigger.
 */
export function FloatingPanel({
  anchor,
  panelRef,
  onDismiss,
  width,
  children,
  ...rest
}: {
  anchor: HTMLElement | null;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onDismiss: () => void;
  width: number;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    // Only dismiss if the anchor trigger element is scrolled completely out of view
    if (r.bottom < 0 || r.top > window.innerHeight) {
      onDismiss();
      return;
    }
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 6, left });
  }, [anchor, width, onDismiss]);

  useEffect(() => {
    if (!anchor) return;
    updatePos();

    const handleScroll = (e: Event) => {
      const target = e.target;
      // Ignore scroll events originating from unrelated containers (e.g. live logs or drawer panels)
      if (
        target &&
        target !== window &&
        target !== document &&
        target !== document.documentElement &&
        target !== document.body &&
        target instanceof Node
      ) {
        if (!target.contains(anchor)) {
          return;
        }
      }
      updatePos();
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [anchor, updatePos]);

  if (!pos) return null;
  return createPortal(
    <div
      ref={panelRef}
      className="popover surface-pop popover-floating"
      style={{ position: 'fixed', top: pos.top, left: pos.left, width }}
      {...rest}
    >
      {children}
    </div>,
    document.body
  );
}
