type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Simple in-memory TTL cache. Suitable for per-instance caching of
 * infrequently-changing lookups (API keys, project config).
 */
export const createTtlCache = <T>(ttlMs: number, maxSize = 500) => {
  const store = new Map<string, CacheEntry<T>>();

  const get = (key: string): T | undefined => {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  };

  const set = (key: string, value: T): void => {
    // Evict oldest entries when at capacity (Map iterates insertion order)
    if (store.size >= maxSize && !store.has(key)) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  };

  const clear = (): void => {
    store.clear();
  };

  return { get, set, clear };
};
