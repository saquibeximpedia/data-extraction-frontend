'use client';

import { createStore, useStore } from './store';

// Long jobs in the browser (copying into a folder, uploading, following a merge) run here, not in
// the page that started them: leaving the page doesn't lose them, and coming back shows their
// progress instead of starting them again.

export interface TaskState<P> {
  progress: P;
  running: boolean;
}

const tasks = createStore<Record<string, TaskState<unknown>>>({});
const controllers = new Map<string, AbortController>();
const NONE: Record<string, TaskState<unknown>> = {};
/** How often a running task's progress is shown */
const PUBLISH_MS = 250;

/**
 * Runs `work` under `key`. It updates `progress` in place (counts change per chunk, so the copy
 * shown is refreshed a few times a second, and once more at the end). Resolves to false without
 * running when a task with that key is still going.
 */
export async function runTask<P extends object>(key: string, progress: P, work: (progress: P, signal: AbortSignal) => Promise<void>): Promise<boolean> {
  if (controllers.has(key)) return false;
  const controller = new AbortController();
  controllers.set(key, controller);
  const publish = (running: boolean) => tasks.set((prev) => ({ ...prev, [key]: { progress: { ...progress }, running } }));
  publish(true);
  const timer = setInterval(() => publish(true), PUBLISH_MS);
  try {
    await work(progress, controller.signal);
  } finally {
    clearInterval(timer);
    controllers.delete(key);
    publish(false);
  }
  return true;
}

/** Asks a running task to stop; it ends once its current step does */
export const stopTask = (key: string) => controllers.get(key)?.abort();

/** A task's latest progress, running or ended (undefined: never run this visit) */
export function useTask<P>(key: string): TaskState<P> | undefined {
  return useStore(tasks, NONE)[key] as TaskState<P> | undefined;
}
