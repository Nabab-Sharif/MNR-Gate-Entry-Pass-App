/**
 * Shared chat-unread store.
 *
 * Maintains a SINGLE realtime subscription per office_id on the `messages`
 * table and tracks per-product / per-gate-pass unread + total counts.
 * ChatIcon components subscribe to changes for their key — this avoids the
 * Supabase realtime throttle that hits when every card opens its own channel.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface UnreadEntry {
  unread: number;
  total: number;
}

type Listener = (entry: UnreadEntry) => void;

interface MessageRow {
  product_id: string | null;
  gate_pass_id: string | null;
  sender_id: string;
  is_read: boolean | null;
}

interface OfficeBucket {
  channel: RealtimeChannel;
  refCount: number;
  currentUserId: string;
  entries: Map<string, UnreadEntry>; // key = product:<id> or gate_pass:<id>
  listeners: Map<string, Set<Listener>>;
  hydrated: boolean;
}

const buckets = new Map<string, OfficeBucket>();

const cacheKey = (officeId: string, userId: string) =>
  `chat_unread_v2_${officeId}_${userId}`;

const loadCache = (officeId: string, userId: string): Record<string, UnreadEntry> => {
  try {
    const raw = localStorage.getItem(cacheKey(officeId, userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCache = (officeId: string, userId: string, b: OfficeBucket) => {
  try {
    const obj: Record<string, UnreadEntry> = {};
    b.entries.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(cacheKey(officeId, userId), JSON.stringify(obj));
  } catch {
    return;
  }
};

const playSound = () => {
  try {
    const a = new Audio('/notification.mp3');
    a.volume = 0.35;
    a.play().catch(() => {});
  } catch {
    return;
  }
};

const notify = (b: OfficeBucket, key: string) => {
  const entry = b.entries.get(key) || { unread: 0, total: 0 };
  b.listeners.get(key)?.forEach((cb) => cb(entry));
};

const keyFor = (m: MessageRow): string | null => {
  if (m.product_id) return `product:${m.product_id}`;
  if (m.gate_pass_id) return `gate_pass:${m.gate_pass_id}`;
  return null;
};

const hydrateFromDB = async (officeId: string, b: OfficeBucket) => {
  const { data } = await supabase
    .from('messages')
    .select('product_id, gate_pass_id, sender_id, is_read')
    .eq('office_id', officeId);
  const fresh = new Map<string, UnreadEntry>();
  (data || []).forEach((m: MessageRow) => {
    const k = keyFor(m);
    if (!k) return;
    const e = fresh.get(k) || { unread: 0, total: 0 };
    e.total += 1;
    if (!m.is_read && m.sender_id !== b.currentUserId) e.unread += 1;
    fresh.set(k, e);
  });
  // Replace entries so removed messages drop off; keep listeners notified.
  const allKeys = new Set<string>([...b.entries.keys(), ...fresh.keys()]);
  b.entries = fresh;
  b.hydrated = true;
  saveCache(officeId, b.currentUserId, b);
  allKeys.forEach((k) => notify(b, k));
};

const ensureBucket = (officeId: string, currentUserId: string): OfficeBucket => {
  let b = buckets.get(officeId);
  if (b) return b;

  const cached = loadCache(officeId, currentUserId);
  const entries = new Map<string, UnreadEntry>();
  Object.entries(cached).forEach(([k, v]) => entries.set(k, v));

  const channel = supabase.channel(`chat-unread-${officeId}-${Math.random().toString(36).slice(2, 8)}`);
  b = {
    channel,
    refCount: 0,
    currentUserId,
    entries,
    listeners: new Map(),
    hydrated: false,
  } as OfficeBucket;
  buckets.set(officeId, b);

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages', filter: `office_id=eq.${officeId}` },
    (payload) => {
      const m = payload.new as MessageRow;
      if (!m) return;
      const k = keyFor(m);
      if (!k) return;
      const e = b!.entries.get(k) || { unread: 0, total: 0 };
      e.total += 1;
      const isFromOther = m.sender_id !== currentUserId;
      if (!m.is_read && isFromOther) e.unread += 1;
      b!.entries.set(k, e);
      saveCache(officeId, currentUserId, b!);
      notify(b!, k);
      if (isFromOther) playSound();
    },
  );
  channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'messages', filter: `office_id=eq.${officeId}` },
    () => { hydrateFromDB(officeId, b!); },
  );
  channel.on(
    'postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'messages', filter: `office_id=eq.${officeId}` },
    () => { hydrateFromDB(officeId, b!); },
  );
  channel.subscribe();

  hydrateFromDB(officeId, b);
  return b;
};

export const subscribeUnread = (
  officeId: string,
  currentUserId: string,
  key: string,
  listener: Listener,
): (() => void) => {
  if (!officeId || !currentUserId || !key) return () => {};
  const b = ensureBucket(officeId, currentUserId);
  b.refCount += 1;
  let set = b.listeners.get(key);
  if (!set) { set = new Set(); b.listeners.set(key, set); }
  set.add(listener);
  // Push current value immediately.
  listener(b.entries.get(key) || { unread: 0, total: 0 });
  return () => {
    set!.delete(listener);
    if (set!.size === 0) b.listeners.delete(key);
    b.refCount -= 1;
    if (b.refCount <= 0) {
      try { supabase.removeChannel(b.channel); } catch {
        // ignore
      }
      buckets.delete(officeId);
    }
  };
};

export const markRead = (officeId: string, key: string) => {
  const b = buckets.get(officeId);
  if (!b) return;
  const e = b.entries.get(key);
  if (!e) return;
  e.unread = 0;
  b.entries.set(key, e);
  saveCache(officeId, b.currentUserId, b);
  notify(b, key);
};
