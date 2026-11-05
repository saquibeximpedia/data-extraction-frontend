'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  /** A short label at the row's right, e.g. how a country's data is had (in the list only) */
  tag?: string;
  /** Explains the tag on hover */
  tagTitle?: string;
}

/**
 * Custom listbox: click or Enter/Space to open, arrows to move, Enter to pick, Escape to close.
 * With `searchable`, a box at the top filters the options by label, meta or value as you type.
 */
export function Select<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  searchable = false,
  searchPlaceholder = 'Search…',
}: {
  id?: string;
  value?: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();
  const listId = useId();
  const current = options.find((o) => o.value === value);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filter = (text: string) => {
    const t = text.trim().toLowerCase();
    return t ? options.filter((o) => [o.label, o.meta, o.value].some((v) => v?.toLowerCase().includes(t))) : options;
  };
  const shown = filter(query);

  // Start keyboard focus on the selected option each time it opens, with the search cleared
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    if (searchable) searchRef.current?.focus();
  }, [open]);

  // Keep the active option in view as the arrows move through a long list
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function search(text: string) {
    setQuery(text);
    setActive(Math.max(0, filter(text).findIndex((o) => !o.disabled)));
  }

  function move(step: number) {
    if (!shown.length) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) {
      i = (i + step + shown.length) % shown.length;
      if (!shown[i].disabled) break;
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
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(shown[active]); }
    else if (e.key === 'Tab') setOpen(false);
  }

  // In the search box, Space types a space instead of picking
  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === ' ') return;
    onKeyDown(e);
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
        <PopoverPanel width="100%" className="select-panel" style={{ minWidth: 240 }}>
          {searchable && (
            <div className="select-search">
              <Icon.Search size={14} />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                onChange={(e) => search(e.target.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>
          )}
          <div className="select-list" role="listbox" id={listId} ref={listRef}>
            {shown.length === 0 && <div className="select-empty">No matches for “{query.trim()}”</div>}
            {shown.map((o, i) => (
              <div
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
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
                {o.tag && (
                  <span className="option-tag" title={o.tagTitle}>
                    {o.tag}
                  </span>
                )}
                {o.value === value && (
                  <span className="option-check">
                    <Icon.Check size={15} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </PopoverPanel>
      )}
    </div>
  );
}
