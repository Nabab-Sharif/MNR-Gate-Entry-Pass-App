import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { cn } from '@/lib/utils';
import { playMessageSound } from '../utils/audioUtils';

interface GlobalChatBellProps {
  officeId?: string;
  currentUserId?: string;
}

const CACHE_KEY = (uid: string) => `chat_unread_${uid}`;

const playSound = () => {
  playMessageSound();
};

const GlobalChatBell: React.FC<GlobalChatBellProps> = ({ officeId, currentUserId }) => {
  // Lazy hydrate from localStorage (offline fallback) so the badge appears instantly.
  const [unread, setUnread] = useState<number>(() => {
    if (!currentUserId) return 0;
    try {
      const v = localStorage.getItem(CACHE_KEY(currentUserId));
      return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
    } catch {
      return 0;
    }
  });
  const [pulse, setPulse] = useState(false);

  const persist = useCallback((n: number) => {
    if (!currentUserId) return;
    try { localStorage.setItem(CACHE_KEY(currentUserId), String(n)); } catch {}
  }, [currentUserId]);

  const fetchUnread = useCallback(async () => {
    if (!officeId || !currentUserId) return;
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('office_id', officeId)
      .eq('is_read', false)
      .neq('sender_id', currentUserId);
    const n = count || 0;
    setUnread(n);
    persist(n);
  }, [officeId, currentUserId, persist]);

  useEffect(() => { fetchUnread(); }, [fetchUnread]);

  useRealtimeSubscription({
    table: 'messages',
    filter: officeId ? { column: 'office_id', value: officeId } : undefined,
    onInsert: (m: any) => {
      if (!currentUserId || m.sender_id === currentUserId) return;
      setUnread(prev => { const n = prev + 1; persist(n); return n; });
      setPulse(true);
      playSound();
      setTimeout(() => setPulse(false), 2500);
    },
    onUpdate: () => { fetchUnread(); },
    onDelete: () => { fetchUnread(); },
    enabled: !!(officeId && currentUserId),
  });

  if (!officeId || !currentUserId) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", pulse && "animate-pulse")}
      title={unread > 0 ? `${unread} unread message${unread > 1 ? 's' : ''}` : 'Chat'}
    >
      <MessageSquare className={cn(
        "h-5 w-5 transition-colors",
        unread > 0 ? "text-emerald-500" : "text-muted-foreground"
      )} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center shadow-md animate-bounce">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Button>
  );
};

export default GlobalChatBell;
