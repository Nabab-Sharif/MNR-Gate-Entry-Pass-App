import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { playNotificationSound } from '../utils/audioUtils';

interface PushNotificationOptions {
  enabled?: boolean;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

export const usePushNotifications = ({
  enabled = true,
  onPermissionGranted,
  onPermissionDenied
}: PushNotificationOptions = {}) => {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    } else {
      setIsSupported(false);
      setPermission('unsupported');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        toast.success('Push notifications enabled!');
        onPermissionGranted?.();
        return true;
      } else if (result === 'denied') {
        toast.error('Push notifications blocked. Please enable in browser settings.');
        onPermissionDenied?.();
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  }, [isSupported, onPermissionGranted, onPermissionDenied]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported) {
      console.warn('Push notifications not supported');
      return null;
    }

    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    try {
      const notificationOptions: NotificationOptions & { vibrate?: number[]; requireInteraction?: boolean } = {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      };

      const notification = new Notification(title, notificationOptions);

      playNotificationSound();

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  const sendGateEntryAlert = useCallback((productName: string, senderName?: string, gateName?: string) => {
    const body = senderName 
      ? `${productName} from ${senderName}${gateName ? ` at ${gateName}` : ''}`
      : `${productName}${gateName ? ` at ${gateName}` : ''}`;
    
    return sendNotification('🚚 New Gate Entry!', {
      body,
      tag: 'gate-entry',
    });
  }, [sendNotification]);

  const sendGatePassAlert = useCallback((productName: string, status: string, storeName?: string) => {
    const statusLabels: Record<string, string> = {
      'pending': 'New Request',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'gate_in': 'Gate IN',
      'gate_out': 'Gate OUT',
      'ready_gate_pass': 'Ready for Pickup',
    };
    
    const label = statusLabels[status] || status;
    const body = `${productName} - ${label}${storeName ? ` (${storeName})` : ''}`;
    
    return sendNotification('📋 Gate Pass Update', {
      body,
      tag: 'gate-pass',
    });
  }, [sendNotification]);

  const sendProductStatusAlert = useCallback((productName: string, status: string) => {
    const statusLabels: Record<string, string> = {
      'entered': 'Gate Entry',
      'on_the_way_store': 'On The Way to Store',
      'in_store': 'Store Received',
      'stock_in_store': 'Stock In Store',
      'on_the_way_dept': 'Sending to Department',
      'know_about': 'Department Notified',
      'received': 'Delivered!',
    };
    
    const label = statusLabels[status] || status;
    
    return sendNotification('📦 Product Status Update', {
      body: `${productName} - ${label}`,
      tag: 'product-status',
    });
  }, [sendNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    sendGateEntryAlert,
    sendGatePassAlert,
    sendProductStatusAlert,
  };
};

export default usePushNotifications;
