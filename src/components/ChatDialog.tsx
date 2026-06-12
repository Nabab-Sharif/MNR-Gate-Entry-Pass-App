import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { playMessageSound, playSendSound, playHoverSound, playSeenSound } from '../utils/audioUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MessageSquare, 
  Send, 
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  message: string;
  sender_id: string;
  sender_role: string;
  created_at: string;
  is_read: boolean;
}

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeId: string;
  productId?: string;
  gatePassId?: string;
  currentUserId: string;
  currentUserRole: string;
  currentUserName: string;
  title: string;
}

// Play notification sound
const playSound = () => {
  playMessageSound();
};

const ChatDialog = forwardRef<HTMLDivElement, ChatDialogProps>(({
  open,
  onOpenChange,
  officeId,
  productId,
  gatePassId,
  currentUserId,
  currentUserRole,
  currentUserName,
  title
}, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchMessages();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, productId, gatePassId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime updates for messages
  useRealtimeSubscription({
    table: 'messages',
    filter: { column: 'office_id', value: officeId },
    onInsert: (newMsg) => {
      if ((productId && newMsg.product_id === productId) || 
          (gatePassId && newMsg.gate_pass_id === gatePassId)) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (newMsg.sender_id !== currentUserId) {
          playSound();
        }
      }
    },
    onUpdate: (updatedMsg) => {
      if ((productId && updatedMsg.product_id === productId) || 
          (gatePassId && updatedMsg.gate_pass_id === gatePassId)) {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
      }
    },
    onDelete: (deletedMsg) => {
      setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
    },
    enabled: open
  });

  const fetchMessages = async () => {
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

      // Mark unread messages as read
      if (data && data.length > 0) {
        const unreadIds = data
          .filter((m: Message) => !m.is_read && m.sender_id !== currentUserId)
          .map((m: Message) => m.id);
        
        if (unreadIds.length > 0) {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .in('id', unreadIds);
          
          setMessages(prev => prev.map(m => 
            unreadIds.includes(m.id) ? { ...m, is_read: true } : m
          ));
          
          // Play seen sound for each marked message
          playSeenSound();
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    const messageToSend = newMessage.trim();
    setNewMessage('');
    setSending(true);
    
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      message: messageToSend,
      sender_id: currentUserId,
      sender_role: currentUserRole,
      created_at: new Date().toISOString(),
      is_read: false
    };
    setMessages(prev => [...prev, optimisticMsg]);
    
    try {
      const { data, error } = await supabase.from('messages').insert({
        office_id: officeId,
        product_id: productId || null,
        gate_pass_id: gatePassId || null,
        sender_id: currentUserId,
        sender_role: currentUserRole as 'admin' | 'gate' | 'store' | 'department',
        message: messageToSend
      }).select().single();

      if (error) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(messageToSend);
        throw error;
      }
      
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));
      playSendSound();
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleEdit = async (messageId: string) => {
    if (!editText.trim()) return;
    try {
      const { error } = await supabase
        .from('messages')
        .update({ message: editText.trim() })
        .eq('id', messageId);
      if (error) throw error;
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, message: editText.trim() } : m
      ));
      setEditingId(null);
      setEditText('');
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const startEditing = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.message);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  const getRoleConfig = (role: string) => {
    switch (role) {
      case 'gate': return { color: 'bg-blue-500', label: 'Gate' };
      case 'store': return { color: 'bg-green-500', label: 'Store' };
      case 'department': return { color: 'bg-orange-500', label: 'Department' };
      case 'admin': return { color: 'bg-purple-500', label: 'Admin' };
      default: return { color: 'bg-gray-500', label: role };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={ref} className="w-[95vw] max-w-lg sm:max-w-2xl lg:max-w-4xl h-[85vh] sm:h-[80vh] flex flex-col p-0 border border-primary/30 shadow-lg">
        <DialogHeader className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-3 border-b border-primary/20">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-full bg-primary/10 flex-shrink-0">
                <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              </div>
              <span className="truncate text-sm sm:text-base">{title}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 min-h-0 bg-muted/20">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-3">
                <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === currentUserId;
              const roleConfig = getRoleConfig(msg.sender_role);
              const isEditing = editingId === msg.id;
              
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-1.5 sm:gap-2 group",
                    isOwn ? "justify-end" : "justify-start"
                  )}
                >
                  {!isOwn && (
                    <div className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white text-[9px] sm:text-[10px] font-bold flex-shrink-0", roleConfig.color)}>
                      {roleConfig.label[0]}
                    </div>
                  )}
                  <div className="flex items-start gap-1">
                    {isOwn && !isEditing && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 sm:h-6 sm:w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem onClick={() => startEditing(msg)}>
                            <Pencil className="h-3 w-3 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(msg.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  <div
                    className={cn(
                      "max-w-[80%] sm:max-w-[75%] rounded-2xl px-3 py-2 shadow-sm border-2 overflow-hidden",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-sm border-primary"
                        : msg.is_read
                        ? "bg-success/10 border-success text-foreground rounded-bl-sm"
                        : "bg-destructive/10 border-destructive text-foreground rounded-bl-sm"
                    )}
                    style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                    onMouseEnter={playHoverSound}
                  >
                      {!isOwn && (
                        <p className="text-[9px] sm:text-[10px] font-medium mb-0.5 opacity-70 capitalize">
                          {msg.sender_role}
                          {!msg.is_read && <span className="ml-1 font-bold text-destructive">●</span>}
                        </p>
                      )}
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="h-7 text-xs sm:text-sm min-w-[120px] sm:min-w-[150px] bg-background text-foreground"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEdit(msg.id);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(msg.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{msg.message}</p>
                      )}
                      <div className={cn(
                        "flex items-center justify-end gap-1.5 text-[9px] sm:text-[10px] mt-1",
                        isOwn ? "text-primary-foreground/60" : msg.is_read ? "text-success" : "text-destructive"
                      )}>
                        <span>{format(new Date(msg.created_at), 'h:mm a')}</span>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          msg.is_read ? "bg-success" : "bg-destructive"
                        )} title={msg.is_read ? "Seen" : "Not seen"} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex-shrink-0 flex gap-2 p-2 sm:p-3 border-t bg-background">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full text-sm h-9 sm:h-10"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button 
            onClick={handleSend} 
            disabled={sending || !newMessage.trim()}
            size="icon"
            className="rounded-full h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

ChatDialog.displayName = 'ChatDialog';

export default ChatDialog;
