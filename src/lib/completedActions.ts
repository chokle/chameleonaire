import { useSyncExternalStore } from "react";

/**
 * Remembers which suggested actions were just run, so the checklist can strike
 * them through and drop them to the bottom even before the account state
 * refreshes (some actions, like "connect YouTube", only finish elsewhere).
 */
const KEY = "coa.completed-actions";
const TTL_MS = 6 * 60 * 60 * 1000;

let store: Record<string, number> = {};
let snapshot = "{}";
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const now = Date.now();
    store = Object.fromEntries(Object.entries(parsed).filter(([, t]) => now - t < TTL_MS));
  } catch {
    store = {};
  }
  snapshot = JSON.stringify(store);
}
load();

function persist() {
  snapshot = JSON.stringify(store);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, snapshot);
    } catch {
      /* storage full or blocked — in-memory is enough */
    }
  }
  listeners.forEach((l) => l());
}

export function markActionDone(id: string) {
  store = { ...store, [id]: Date.now() };
  persist();
}

export function clearActionDone(id: string) {
  const { [id]: _drop, ...rest } = store;
  store = rest;
  persist();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Set of action ids finished in this browser recently. */
export function useCompletedActions(): Set<string> {
  const json = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => "{}",
  );
  return new Set(Object.keys(JSON.parse(json) as Record<string, number>));
}
