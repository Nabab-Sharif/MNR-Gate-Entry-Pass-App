import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface Message {
  id: string;
  message: string;
  sender_id: string;
  sender_role: string;
  created_at: string;
  is_read: boolean;
}

interface UseChatMessagesOptions {
  officeId: string;
  productId?: string;
  gatePassId?: string;
  enabled?: boolean;
}

export const useChatMessages = ({
  officeId,
  productId,
  gatePassId,
  enabled = true
}: UseChatMessagesOptions) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchMessages = useCallback(async () => {
    if (!enabled || !officeId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('office_id', officeId)
        .order('created_at', { ascending: true });

      if (productId) {
        query = query.eq('product_id', productId);
      } else if (gatePassId) {
        query = query.eq('gate_pass_id', gatePassId);
      }

      const { data } = await query;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [officeId, productId, gatePassId, enabled]);

  // Fetch messages on mount and when options change
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Calculate unread count
  useEffect(() => {
    const unread = messages.filter(m => !m.is_read).length;
    setUnreadCount(unread);
  }, [messages]);

  // Realtime subscription
  useRealtimeSubscription({
    table: 'messages',
    filter: officeId ? { column: 'office_id', value: officeId } : undefined,
    onInsert: (newMsg) => {
      // Check if message is for this product/gate pass
      if ((productId && newMsg.product_id === productId) || 
          (gatePassId && newMsg.gate_pass_id === gatePassId)) {
        setMessages(prev => [...prev, newMsg]);
        
        // Play sound for new message
        playMessageSound();
      }
    },
    enabled: enabled && !!officeId
  });

  const sendMessage = async (
    message: string,
    senderId: string,
    senderRole: 'admin' | 'gate' | 'store' | 'department'
  ) => {
    if (!message.trim()) return { error: 'Message is empty' };

    try {
      const { error } = await supabase.from('messages').insert({
        office_id: officeId,
        product_id: productId || null,
        gate_pass_id: gatePassId || null,
        sender_id: senderId,
        sender_role: senderRole,
        message: message.trim()
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error sending message:', error);
      return { error: 'Failed to send message' };
    }
  };

  return {
    messages,
    loading,
    unreadCount,
    sendMessage,
    refetch: fetchMessages
  };
};

// Play notification sound for new messages
const playMessageSound = () => {
  try {
    // Try to play audio file first
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Fallback: use Web Audio API for a simple beep
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        setTimeout(() => oscillator.stop(), 100);
      } catch (e) {
        // Silent fallback if audio fails
      }
    });
  } catch (e) {
    // Silent fallback
  }
};

export default useChatMessages;
