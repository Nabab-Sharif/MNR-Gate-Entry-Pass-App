import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { playNotificationSound } from '../utils/audioUtils';

type TableName =
  | 'products'
  | 'gate_passes'
  | 'messages'
  | 'notifications'
  | 'offices'
  | 'gates'
  | 'stores'
  | 'departments'
  | 'gate_pass_timeline'
  | 'product_timeline';

interface UseRealtimeOptions {
  table: TableName;
  filter?: { column: string; value: string };
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  enabled?: boolean;
}

/**
 * Realtime subscription hook with stable callbacks (refs) so the channel
 * isn't torn down on every render. This is critical for reliable delivery.
 */
export const useRealtimeSubscription = ({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions) => {
  // Keep latest callbacks in refs so we don't resubscribe each render.
  const insertRef = useRef(onInsert);
  const updateRef = useRef(onUpdate);
  const deleteRef = useRef(onDelete);

  useEffect(() => {
    insertRef.current = onInsert;
    updateRef.current = onUpdate;
    deleteRef.current = onDelete;
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled) return;

    const filterStr = filter ? `${filter.column}=eq.${filter.value}` : '';
    const channelName = filter
      ? `${table}-${filter.column}-${filter.value}-${Math.random().toString(36).slice(2, 8)}`
      : `${table}-changes-${Math.random().toString(36).slice(2, 8)}`;

    const channel: RealtimeChannel = supabase.channel(channelName);

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table, ...(filter && { filter: filterStr }) },
      (payload) => insertRef.current?.(payload.new),
    );
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table, ...(filter && { filter: filterStr }) },
      (payload) => updateRef.current?.(payload.new),
    );
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table, ...(filter && { filter: filterStr }) },
      (payload) => deleteRef.current?.(payload.old),
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Only depend on stable primitives — NOT the callback identities.
  }, [table, filter?.column, filter?.value, enabled]);
};

// Voice alert hook (updated to use Web Audio API)
export const useVoiceAlert = () => {
  const playAlert = useCallback((message: string) => {
    playNotificationSound();
  }, []);

  return { playAlert };
};
