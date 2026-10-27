'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A glass bar pinned to the bottom of the window (selection actions, unsaved changes). Rendered
 * into <body>: inside an animated card, position: fixed would follow the card instead.
 */
export function Dock({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className={`selection-dock ${open ? 'on' : ''}`} aria-live="polite" aria-hidden={!open}>
      <div className="selection-dock-inner liquid">{children}</div>
    </div>,
    document.body
  );
}
