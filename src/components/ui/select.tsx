'use client';

import { useEffect, useId, useState } from 'react';
import { usePopover, PopoverPanel } from './popover';
import { Icon } from './icons';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Muted text after the label, e.g. a code */
  meta?: string;
  /** Second line under the label */
  hint?: string;
  disabled?: boolean;
  /** Leading visual, e.g. a code avatar */
  prefix?: React.ReactNode;
}

/** Custom listbox: click or Enter/Space to open, arrows to move, Enter to pick, Escape to close */
export function Select<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: {
  id?: string;
  value?: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();
  const listId = useId();
  const current = options.find((o) => o.value === value);
  const [active, setActive] = useState(0);

  // Start keyboard focus on the selected option each time it opens
  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open]);

  function move(step: number) {
    if (!options.length) return;
    let i = active;
    for (let n = 0; n < options.length; n++) {
      i = (i + step + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    setActive(i);
  }

  function pick(option?: SelectOption<T>) {
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(options[active]); }
    else if (e.key === 'Tab') setOpen(false);
  }

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="control select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        {current?.prefix}
        <span className={`select-value ${current ? '' : 'placeholder'}`}>
          {current ? current.label : placeholder}
          {current?.meta && <span className="select-meta">{current.meta}</span>}
        </span>
        <span className={`select-chevron ${open ? 'open' : ''}`}>
          <Icon.ChevronDown />
        </span>
      </button>

      {open && (
        <PopoverPanel width="100%" role="listbox" id={listId} style={{ minWidth: 240 }}>
          {options.map((o, i) => (
            <div
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled}
              className={`option ${i === active ? 'active' : ''} ${o.disabled ? 'disabled' : ''}`}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o)}
            >
              {o.prefix}
              <span className="option-text">
                <span className="option-label">
                  {o.label}
                  {o.meta && <span className="select-meta">{o.meta}</span>}
                </span>
                {o.hint && <span className="option-hint">{o.hint}</span>}
              </span>
              {o.value === value && (
                <span className="option-check">
                  <Icon.Check size={15} />
                </span>
              )}
            </div>
          ))}
        </PopoverPanel>
      )}
    </div>
  );
}
