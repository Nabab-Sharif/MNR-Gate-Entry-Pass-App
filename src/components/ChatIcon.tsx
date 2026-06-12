import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subscribeUnread, markRead } from '@/lib/chatUnreadStore';

interface ChatIconProps {
  officeId: string;
  productId?: string;
  gatePassId?: string;
  currentUserId: string;
  onClick: () => void;
  size?: 'sm' | 'default';
  variant?: 'ghost' | 'outline' | 'default';
  showLabel?: boolean;
  className?: string;
}

const ChatIcon: React.FC<ChatIconProps> = ({
  officeId,
  productId,
  gatePassId,
  currentUserId,
  onClick,
  size = 'sm',
  variant = 'ghost',
  showLabel = true,
  className,
}) => {
  const key = productId
    ? `product:${productId}`
    : gatePassId
    ? `gate_pass:${gatePassId}`
    : '';

  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [pulse, setPulse] = useState(false);
  const prevUnreadRef = useRef(0);

  useEffect(() => {
    if (!officeId || !currentUserId || !key) return;
    const unsub = subscribeUnread(officeId, currentUserId, key, (entry) => {
      setUnread((prev) => {
        if (entry.unread > prev) {
          setPulse(true);
          setTimeout(() => setPulse(false), 2500);
        }
        prevUnreadRef.current = entry.unread;
        return entry.unread;
      });
      setTotal(entry.total);
    });
    return unsub;
  }, [officeId, currentUserId, key]);

  const handleClick = () => {
    setPulse(false);
    setUnread(0);
    if (officeId && key) markRead(officeId, key);
    onClick();
  };

  const hasUnread = unread > 0;
  const hasAny = total > 0;

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleClick}
      className={cn(
        'relative gap-1 sm:gap-1.5 flex items-center',
        size === 'sm' ? 'h-7 sm:h-8 px-1.5 sm:px-2.5' : 'px-2 sm:px-3',
        pulse && 'animate-pulse',
        className,
      )}
    >
      <div className="relative flex items-center">
        <MessageSquare
          className={cn(
            size === 'sm' ? 'h-3.5 w-3.5 sm:h-4 sm:w-4' : 'h-4 w-4 sm:h-5 sm:w-5',
            hasUnread ? 'text-emerald-500' : hasAny ? 'text-red-500' : 'text-gray-400',
            pulse && 'animate-bounce',
          )}
        />
        {hasUnread && (
          <span className="absolute -top-2 -right-2 sm:-top-2.5 sm:-right-2.5 min-w-[14px] sm:min-w-[18px] h-[14px] sm:h-[18px] px-0.5 sm:px-1 rounded-full bg-emerald-500 text-[8px] sm:text-[10px] font-bold text-white flex items-center justify-center shadow-md animate-bounce">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {!hasUnread && hasAny && (
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full border border-background bg-red-500 animate-pulse" />
        )}
      </div>
      {showLabel && (
        <span
          className={cn(
            'hidden xs:inline text-[10px] sm:text-xs font-medium',
            hasUnread ? 'text-emerald-500' : hasAny ? 'text-red-500' : 'text-gray-400',
          )}
        >
          {hasUnread ? `Chat (${unread})` : 'Chat'}
        </span>
      )}
    </Button>
  );
};

export default ChatIcon;
