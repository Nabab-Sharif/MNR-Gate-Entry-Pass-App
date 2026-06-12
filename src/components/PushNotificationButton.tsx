import React from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PushNotificationButtonProps {
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
}

const PushNotificationButton: React.FC<PushNotificationButtonProps> = ({
  className,
  variant = 'ghost',
  size = 'icon',
}) => {
  const { isSupported, permission, requestPermission } = usePushNotifications();

  if (!isSupported) {
    return null;
  }

  const getIcon = () => {
    switch (permission) {
      case 'granted':
        return <BellRing className="h-5 w-5 text-success" />;
      case 'denied':
        return <BellOff className="h-5 w-5 text-destructive" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getTooltip = () => {
    switch (permission) {
      case 'granted':
        return 'Push notifications enabled';
      case 'denied':
        return 'Push notifications blocked - enable in browser settings';
      default:
        return 'Enable push notifications';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={cn(
              permission === 'granted' && 'text-success',
              permission === 'denied' && 'text-destructive opacity-50',
              className
            )}
            onClick={() => permission === 'default' && requestPermission()}
            disabled={permission === 'denied'}
          >
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltip()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default PushNotificationButton;
