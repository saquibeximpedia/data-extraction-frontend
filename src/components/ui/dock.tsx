'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLatched } from './presence';

/**
 * A bar pinned to the bottom of the window (selection actions, unsaved changes). Rendered
 * into <body>: inside an animated card, position: fixed would follow the card instead.
 */
export function Dock({ open, children, innerRef }: { open: boolean; children: React.ReactNode; innerRef?: React.Ref<HTMLDivElement> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Sliding away, it keeps what it showed (e.g. "3 selected", not "0 selected")
  const content = useLatched(children, open);
  if (!mounted) return null;
  return createPortal(
    <div className={`selection-dock ${open ? 'on' : ''}`} aria-live="polite" aria-hidden={!open}>
      <div ref={innerRef} className="selection-dock-inner">
        {content}
      </div>
    </div>,
    document.body
  );
}
