/**
 * Lightweight IndexedDB cache for instant data loads.
 *
 * Strategy:
 *  - On page load, read from cache FIRST and render immediately.
 *  - In parallel, fetch fresh data from Supabase and silently update both
 *    the cache and UI (conflict-free merge by `id`).
 *  - Realtime subscriptions deliver granular INSERT / UPDATE / DELETE events
 *    that update only the changed row in state and cache.
 */

const DB_NAME = 'flowgate-cache';
const DB_VERSION = 3;
const STORES = ['products', 'gate_passes', 'messages', 'notifications', 'offices', 'gates', 'stores', 'departments'] as const;
type CacheStore = typeof STORES[number];
const STORE_INDEXES: Partial<Record<CacheStore, string[]>> = {
  products: ['gate_id', 'store_id', 'department_id'],
  gate_passes: ['gate_id', 'store_id', 'department_id'],
  messages: ['office_id'],
  notifications: ['user_id'],
  gates: ['office_id', 'user_id'],
  stores: ['office_id', 'user_id'],
  departments: ['office_id', 'user_id'],
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((s) => {
        const objectStore = db.objectStoreNames.contains(s)
          ? req.transaction!.objectStore(s)
          : db.createObjectStore(s, { keyPath: 'id' });
        STORE_INDEXES[s]?.forEach((indexName) => {
          if (!objectStore.indexNames.contains(indexName)) {
            objectStore.createIndex(indexName, indexName, { unique: false });
          }
        });
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

export async function getCached<T extends { id: string }>(
  store: CacheStore,
  scopeKey?: string,
  scopeValue?: string,
): Promise<T[]> {
  try {
    const db = await openDB();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const objectStore = tx.objectStore(store);
      const hasScopedIndex = !!scopeKey && !!scopeValue && objectStore.indexNames.contains(scopeKey);
      const req = hasScopedIndex ? objectStore.index(scopeKey).getAll(scopeValue) : objectStore.getAll();
      req.onsuccess = () => {
        let rows = (req.result as T[]) || [];
        if (scopeKey && scopeValue && !hasScopedIndex) {
          rows = rows.filter((r: any) => r?.[scopeKey] === scopeValue);
        }
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function setCached<T extends { id: string }>(
  store: CacheStore,
  rows: T[],
  scopeKey?: string,
  scopeValue?: string,
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      // Replace just the rows in scope to avoid clobbering other gates/stores.
      if (scopeKey && scopeValue) {
        const getAllReq = os.getAll();
        getAllReq.onsuccess = () => {
          const existing = (getAllReq.result as any[]) || [];
          existing
            .filter((r) => r?.[scopeKey] === scopeValue)
            .forEach((r) => os.delete(r.id));
          rows.forEach((r) => os.put(r));
        };
      } else {
        rows.forEach((r) => os.put(r));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function upsertCached<T extends { id: string }>(
  store: CacheStore,
  row: T,
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function deleteCached(store: CacheStore, id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

/**
 * Conflict-free merge: replaces only rows with matching ids; keeps other
 * locally-cached rows; appends new ones. Server data wins for matched ids.
 */
export function mergeById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  if (!prev.length) return next;
  const map = new Map<string, T>();
  prev.forEach((r) => map.set(r.id, r));
  next.forEach((r) => map.set(r.id, { ...(map.get(r.id) || {} as T), ...r }));
  return Array.from(map.values());
}
