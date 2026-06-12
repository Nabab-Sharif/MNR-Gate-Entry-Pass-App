import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { cn } from '@/lib/utils';
import { playMessageSound } from '../utils/audioUtils';

interface ChatButtonProps {
  officeId: string;
  productId?: string;
  gatePassId?: string;
  currentUserId: string;
  onClick: () => void;
  size?: 'sm' | 'default';
  variant?: 'ghost' | 'outline' | 'default';
  showLabel?: boolean;
  showTotalCount?: boolean;
  className?: string;
}

const ChatButton: React.FC<ChatButtonProps> = ({
  officeId,
  productId,
  gatePassId,
  currentUserId,
  onClick,
  size = 'sm',
  variant = 'ghost',
  showLabel = true,
  showTotalCount = false,
  className
}) => {
  const cacheKey = `chat_unread_${productId || gatePassId || 'none'}_${currentUserId}`;
  const totalCacheKey = `chat_total_${productId || gatePassId || 'none'}_${currentUserId}`;

  // Lazy hydrate badge from localStorage so it appears instantly (offline fallback)
  const [unreadCount, setUnreadCount] = useState(() => {
    try { return Math.max(0, parseInt(localStorage.getItem(cacheKey) || '0', 10) || 0); } catch { return 0; }
  });
  const [othersMessageCount, setOthersMessageCount] = useState(() => {
    try { return Math.max(0, parseInt(localStorage.getItem(totalCacheKey) || '0', 10) || 0); } catch { return 0; }
  });
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const persistCounts = (unread: number, total: number) => {
    try {
      localStorage.setItem(cacheKey, String(unread));
      localStorage.setItem(totalCacheKey, String(total));
    } catch {}
  };

  const fetchUnreadCount = async () => {
    try {
      // Get unread messages from OTHERS only
      let query = supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('office_id', officeId)
        .eq('is_read', false)
        .neq('sender_id', currentUserId);

      if (productId) {
        query = query.eq('product_id', productId);
      } else if (gatePassId) {
        query = query.eq('gate_pass_id', gatePassId);
      }

      const { count } = await query;
      const unread = count || 0;
      setUnreadCount(unread);

      // Get total messages from OTHERS only (for green count)
      let totalQuery = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .neq('sender_id', currentUserId);

      if (productId) {
        totalQuery = totalQuery.eq('product_id', productId);
      } else if (gatePassId) {
        totalQuery = totalQuery.eq('gate_pass_id', gatePassId);
      }

      const { count: othersCount } = await totalQuery;
      const total = othersCount || 0;
      setOthersMessageCount(total);
      persistCounts(unread, total);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    if (!officeId || (!productId && !gatePassId)) return;
    fetchUnreadCount();
    // No polling — realtime subscription below keeps the count fresh.
  }, [officeId, productId, gatePassId, currentUserId]);

  // Listen for new messages and updates — filter directly on product/gate pass
  // for efficient per-channel delivery (avoids fanout across whole office).
  useRealtimeSubscription({
    table: 'messages',
    filter: productId
      ? { column: 'product_id', value: productId }
      : gatePassId
      ? { column: 'gate_pass_id', value: gatePassId }
      : undefined,
    onInsert: (newMsg) => {
      if (newMsg.sender_id === currentUserId) return;
      setUnreadCount(prev => { const n = prev + 1; persistCounts(n, othersMessageCount + 1); return n; });
      setOthersMessageCount(prev => prev + 1);
      setHasNewMessage(true);
      playMessageSound();
      setTimeout(() => setHasNewMessage(false), 2000);
    },
    onUpdate: (updatedMsg) => {
      if (updatedMsg.sender_id === currentUserId) return;
      fetchUnreadCount();
    },
    onDelete: () => {
      fetchUnreadCount();
    },
    enabled: !!(officeId && (productId || gatePassId))
  });

  // Seen = green (no count badge), Unseen = red (with count badge)
  const isSeen = unreadCount === 0;
  const hasOthersMessages = othersMessageCount > 0;
  

  const handleButtonClick = () => {
    setHasNewMessage(false);
    setUnreadCount(0);
    persistCounts(0, othersMessageCount);
    onClick();
    window.setTimeout(() => {
      fetchUnreadCount();
    }, 500);
  };

  return (
    <Button 
      size={size} 
      variant={variant} 
      className={cn(
        "relative gap-1.5",
        size === 'sm' ? "h-8 px-2.5" : "",
        hasNewMessage && "animate-pulse",
        "flex items-center",
        className
      )} 
      onClick={handleButtonClick}
    >
      <div className="relative flex items-center">
        <MessageSquare className={cn(
          size === 'sm' ? "h-3.5 w-3.5" : "h-4 w-4",
          // Green if unread (new messages), Red if all read, Gray if no messages
          unreadCount > 0 ? "text-emerald-500" : hasOthersMessages ? "text-red-500" : "text-gray-400",
          hasNewMessage && "animate-bounce"
        )} />
        {/* Seen/Unseen indicator dot - Only show if there are others' messages */}
        {hasOthersMessages && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-background",
            unreadCount > 0 ? "bg-emerald-500" : "bg-red-500",
            "animate-pulse"
          )} />
        )}
        {/* Show GREEN count badge only for UNREAD messages from others */}
        {unreadCount > 0 && (
          <span className="absolute -top-2.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center animate-bounce shadow-md">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* Show RED indicator (NO count) when all READ but messages from others exist */}
        {isSeen && hasOthersMessages && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-red-500 animate-pulse" />
        )}
      </div>
      {showLabel && (
        <span className={cn(
          "text-xs font-medium",
          unreadCount > 0 ? "text-emerald-500" : hasOthersMessages ? "text-red-500" : "text-gray-400"
        )}>
          {unreadCount > 0 ? `Chat (${unreadCount})` : hasOthersMessages ? `Chat` : "Chat"}
        </span>
      )}
    </Button>
  );
};

export default ChatButton;
