'use client';

import { useCallback, useState, useSyncExternalStore, type SetStateAction } from 'react';

// State kept outside React, in this browser tab: it outlives the pages that show it, so leaving a
// page and coming back finds it as it was (a full reload starts over).

export interface Store<T> {
  get: () => T;
  set: (next: SetStateAction<T>) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** A store's value; re-renders when it changes. The server (and hydration) sees `initial`. */
export function useStore<T>(store: Store<T>, initial: T = store.get()): T {
  return useSyncExternalStore(store.subscribe, store.get, () => initial);
}

const kept = createStore<Record<string, unknown>>({});
const EMPTY: Record<string, unknown> = {};

/**
 * Like useState, but kept under `key` for the whole visit: a form or view left and opened again
 * shows what it had. `initial` is used until the key is first set.
 */
export function useGlobalState<T>(key: string, initial: T | (() => T)): [T, (next: SetStateAction<T>) => void] {
  const [fallback] = useState(initial);
  const all = useStore(kept, EMPTY);
  const value = (key in all ? all[key] : fallback) as T;
  const set = useCallback(
    (next: SetStateAction<T>) =>
      kept.set((prev) => {
        const current = (key in prev ? prev[key] : fallback) as T;
        return { ...prev, [key]: typeof next === 'function' ? (next as (p: T) => T)(current) : next };
      }),
    [key, fallback]
  );
  return [value, set];
}

/** Drops every kept value whose key starts with `prefix`, so its form starts over */
export function forgetGlobalState(prefix: string): void {
  kept.set((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))));
}

/** Whether anything is kept under `prefix` */
export function useHasGlobalState(prefix: string): boolean {
  const all = useStore(kept, EMPTY);
  return Object.keys(all).some((k) => k.startsWith(prefix));
}
