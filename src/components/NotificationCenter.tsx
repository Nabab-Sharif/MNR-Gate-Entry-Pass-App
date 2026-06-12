import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { playNotificationSound, playHoverSound } from '../utils/audioUtils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Package, FileText, Check, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { getCached, setCached, upsertCached, deleteCached, mergeById } from '@/lib/indexedDBCache';

interface Notification {
  id: string;
  user_id: string;
  office_id: string;
  title: string;
  message: string;
  type: string | null;
  is_read: boolean | null;
  created_at: string;
  related_product_id: string | null;
  related_gate_pass_id: string | null;
}

interface NotificationCenterProps {
  userId?: string;
  showAll?: boolean;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId, showAll = false }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    // 1) Instant load from cache
    const cached = showAll
      ? await getCached<Notification>('notifications')
      : await getCached<Notification>('notifications', 'user_id', userId);
    if (cached.length) {
      setNotifications(prev => mergeById(prev, cached).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      setLoading(false);
    }

    // 2) Silent network refresh
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!showAll) query = query.eq('user_id', userId);

      const { data, error } = await query;

      if (error) throw error;
      setNotifications(data || []);
      if (data) void setCached<Notification>('notifications', data, showAll ? undefined : 'user_id', showAll ? undefined : userId);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, showAll]);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId, showAll, fetchNotifications]);

  // Realtime updates for notifications — granular cache + state merge
  useRealtimeSubscription({
    table: 'notifications',
    filter: showAll ? undefined : userId ? { column: 'user_id', value: userId } : undefined,
    onInsert: (newNotification) => {
      setNotifications(prev =>
        prev.some(n => n.id === newNotification.id) ? prev : [newNotification, ...prev]
      );
      void upsertCached('notifications', newNotification);
      playNotificationSound();
      if ('Notification' in window && Notification.permission === 'granted') {
        new window.Notification(newNotification.title, {
          body: newNotification.message,
          icon: '/favicon.ico',
        });
      }
    },
    onUpdate: (updated) => {
      setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
      void upsertCached('notifications', updated);
    },
    onDelete: (deleted) => {
      setNotifications(prev => prev.filter(n => n.id !== deleted.id));
      void deleteCached('notifications', deleted.id);
    },
    enabled: !!userId
  });

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    setDeletingId(notificationId);
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const clearAllNotifications = async () => {
    if (!userId) return;
    if (!window.confirm('Clear all notifications?')) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!showAll && !notification.is_read) {
      await markAsRead(notification.id);
    }

    const { data: { user } } = await supabase.auth.getUser();
    // Prefer canonical role from `user_roles` table, fallback to user_metadata
    let role: string | null = user?.user_metadata?.role || null;
    try {
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (roleRow?.role) role = roleRow.role;
    } catch (err) {
      console.error('Failed to resolve user role from user_roles table:', err);
    }

    const rolePathMap: Record<string, string> = {
      gate: '/gate',
      store: '/store',
      department: '/department',
      admin: '/admin',
    };
    const basePath = role === 'sub_admin' && notification.office_id
      ? `/sub-admin/offices/${notification.office_id}`
      : rolePathMap[role || ''] || '/';

    // Build query params so the target page can auto-open the specific item
    const params = new URLSearchParams();
    if (notification.type === 'product' && notification.related_product_id) {
      params.set('highlight_product', notification.related_product_id);
    } else if (notification.type === 'gate_pass' && notification.related_gate_pass_id) {
      params.set('highlight_gatepass', notification.related_gate_pass_id);
    }

    const query = params.toString();
    const targetPath = query ? `${basePath}?${query}` : basePath;
    console.debug('Notification click navigation', { notification, basePath, targetPath, pathname: window.location.pathname });
    // Always navigate to the target path so the page receives the query params.
    try {
      navigate(targetPath);
    } catch (err) {
      console.error('Navigation error on notification click:', err);
      // Fallback to hard redirect if SPA navigation fails
      window.location.href = targetPath;
    }
    setOpen(false);
  };

  const getNotificationIcon = (type: string | null) => {
    switch (type) {
      case 'product':
        return <Package className="h-4 w-4 text-primary" />;
      case 'gate_pass':
        return <FileText className="h-4 w-4 text-success" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case 'product':
        return 'bg-primary/10 text-primary';
      case 'gate_pass':
        return 'bg-success/10 text-success';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm sm:text-base">Notifications</h3>
          <div className="flex items-center gap-1">
            {!showAll && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={markAllAsRead}
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            {!showAll && notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-destructive hover:text-destructive"
                onClick={clearAllNotifications}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[350px] sm:h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll see updates here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`p-3 sm:p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  onMouseEnter={playHoverSound}
                >
                  <div className="flex gap-2 sm:gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${getTypeColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs sm:text-sm font-medium truncate ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </p>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {!notification.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                          )}
                          {!showAll && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteNotification(notification.id);
                              }}
                              disabled={deletingId === notification.id}
                            >
                              {deletingId === notification.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
