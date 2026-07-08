export interface LocalStorageStore<T> {
  get: () => T;
  getServerSnapshot: () => T;
  subscribe: (callback: () => void) => () => void;
  set: (value: T) => void;
}

/**
 * A tiny external store (for React's `useSyncExternalStore`) backed by
 * localStorage. Centralizes the "read on the client, fall back to a default
 * on the server, notify subscribers on write" boilerplate shared by every
 * piece of persisted UI state in this app (sidebar collapsed, assistant
 * panel width, etc.) instead of re-implementing it per feature.
 */
export function createLocalStorageStore<T>({
  key,
  defaultValue,
  serialize = (value: T) => String(value),
  deserialize,
}: {
  key: string;
  defaultValue: T;
  serialize?: (value: T) => string;
  deserialize: (raw: string) => T;
}): LocalStorageStore<T> {
  const listeners = new Set<() => void>();

  function get(): T {
    if (typeof window === "undefined") return defaultValue;
    const raw = localStorage.getItem(key);
    return raw === null ? defaultValue : deserialize(raw);
  }

  return {
    get,
    getServerSnapshot: () => defaultValue,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    set: (value: T) => {
      localStorage.setItem(key, serialize(value));
      listeners.forEach((listener) => listener());
    },
  };
}
