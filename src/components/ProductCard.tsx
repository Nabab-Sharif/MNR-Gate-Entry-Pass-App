import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Package,
  Truck,
  CheckCircle2,
  ArrowRightFromLine,
  ArrowLeftToLine,
  Loader2,
  Eye,
  Clock,
  DoorOpen,
  Users,
  Undo2,
  RotateCcw,
  Pencil,
  Trash2,
  MessageCircle,
  ChevronRight,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ChatDialog from './ChatDialog';
import ChatButton from './ChatIcon';
import ProductFlowTimeline, { ProductStatusBadge, ProductFlowProgress, getProductStatusConfig } from './ProductFlowTimeline';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';

interface TimelineEvent {
  id: string;
  status: string;
  action_by_name: string | null;
  action_role: string | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  quantity: number;
  status: string;
  image_url: string;
  office_id: string;
  sender_name: string | null;
  receiver_name: string | null;
  sender_company?: string | null;
  receiver_company?: string | null;
  created_at: string;
  departments?: { name: string; whatsapp_number?: string | null };
  gates?: { name: string; whatsapp_number?: string | null };
  stores?: { name: string; whatsapp_number?: string | null };
  product_items?: { id: string; name: string; quantity: number }[];
}

interface ProductCardProps {
  product: Product;
  userRole: 'gate' | 'store' | 'department';
  userName: string;
  onStatusUpdate?: () => void;
  onEdit?: () => void;
  showEditButton?: boolean;
  showDeleteButton?: boolean;
  autoOpen?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, userRole, userName, onStatusUpdate, onEdit, showEditButton, showDeleteButton, autoOpen }) => {
  const [showDetail, setShowDetail] = useState(autoOpen || false);
  const [showChat, setShowChat] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [updating, setUpdating] = useState(false);
  const [userId, setUserId] = useState('');
  const [clickedWhatsAppNumbers, setClickedWhatsAppNumbers] = useState<string[]>([]);
  const [currentStatus, setCurrentStatus] = useState(product.status);
  const [lastAction, setLastAction] = useState<{ previousStatus: string; currentStatus: string } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const { color: themeColor } = useTheme();

  const borderClass = React.useMemo(() => {
    switch (themeColor) {
      case 'navy': return 'border-blue-500/30';
      case 'emerald': return 'border-emerald-500/30';
      case 'purple': return 'border-purple-500/30';
      case 'rose': return 'border-rose-500/30';
      case 'amber': return 'border-amber-500/30';
      case 'slate': return 'border-slate-500/30';
      default: return 'border-primary/30';
    }
  }, [themeColor]);

  // Load the authenticated user immediately so every card-level chat icon can
  // subscribe to unread realtime updates before the user opens the card/chat.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted && user?.id) setUserId(user.id);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // React to autoOpen from notification deep links: open detail + scroll into view + load timeline
  useEffect(() => {
    if (autoOpen) {
      setShowDetail(true);
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      fetchTimeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  // Sync product status when prop changes (realtime update from parent)
  useEffect(() => {
    setCurrentStatus(product.status);
  }, [product.status]);

  // Auto-hide undo option after 5 seconds
  useEffect(() => {
    if (showUndoToast) {
      const timer = setTimeout(() => {
        setShowUndoToast(false);
        setLastAction(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showUndoToast]);

  const fetchTimeline = async () => {
    const { data } = await supabase
      .from('product_timeline')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false });
    setTimeline(data || []);
  };

  const handleOpenDetail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    setShowDetail(true);
    fetchTimeline();
  };

  const handleOpenChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    setShowChat(true);
  };

  const updateProductStatus = async (newStatus: string, isUndo: boolean = false) => {
    // Optimistic update: show green immediately
    const previousStatus = currentStatus;
    setCurrentStatus(newStatus);
    setUpdating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get product details for notifications
      const { data: productData } = await supabase
        .from('products')
        .select('office_id, department_id, gate_id, departments(user_id), gates(user_id)')
        .eq('id', product.id)
        .single();

      const { error: updateError } = await supabase
        .from('products')
        .update({
          status: newStatus,
          last_action_by: user?.id,
          last_action_role: userRole,
          last_action_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      await supabase.from('product_timeline').insert({
        product_id: product.id,
        status: isUndo ? `undo_to_${newStatus}` : newStatus,
        action_by: user?.id,
        action_by_name: isUndo ? `${userName} (Undo)` : (userName || 'Unknown'),
        action_role: userRole
      });

      // Create notifications for relevant users
      if (productData && !isUndo) {
        const notifications = [];
        const statusLabel = getProductStatusConfig(newStatus).label;

        // Notify department user
        if (productData.departments?.user_id) {
          notifications.push({
            user_id: productData.departments.user_id,
            office_id: productData.office_id,
            title: `Product ${statusLabel}`,
            message: `${product.name} status updated to ${statusLabel} by ${userName}`,
            type: 'product',
            is_read: false,
            related_product_id: product.id
          });
        }

        // Notify gate user for relevant statuses
        if (productData.gates?.user_id && (newStatus === 'in_store' || newStatus === 'received')) {
          notifications.push({
            user_id: productData.gates.user_id,
            office_id: productData.office_id,
            title: `Product ${statusLabel}`,
            message: `${product.name} status updated to ${statusLabel}`,
            type: 'product',
            is_read: false,
            related_product_id: product.id
          });
        }

        if (notifications.length > 0) {
          const { error: notifError } = await supabase.from('notifications').insert(notifications);
          if (notifError) {
            console.error('Notification creation failed:', notifError);
          }
        }
      }

      if (isUndo) {
        toast.success('Action undone successfully');
        setShowUndoToast(false);
        setLastAction(null);
      } else {
        toast.success(`Status updated to ${getProductStatusConfig(newStatus).label}`);
        // Store last action for undo
        setLastAction({ previousStatus, currentStatus: newStatus });
        setShowUndoToast(true);
      }

      fetchTimeline();
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update status');
      // Rollback optimistic update on error
      setCurrentStatus(previousStatus);
    } finally {
      setUpdating(false);
    }
  };

  const handleUndo = () => {
    if (lastAction) {
      updateProductStatus(lastAction.previousStatus, true);
    }
  };

  const getWhatsAppNumbers = (whatsapp?: string | null) => {
    return whatsapp
      ? whatsapp
          .split(',')
          .map((num) => num.trim())
          .filter((num) => num.length > 0)
      : [];
  };

  const handleWhatsAppClick = (cleanNumber: string) => {
    setClickedWhatsAppNumbers((prev) =>
      prev.includes(cleanNumber) ? prev : [...prev, cleanNumber]
    );
  };

  const getActionButtons = () => {
    const buttons: { label: string; status: string; icon: React.ReactNode; variant: 'default' | 'destructive' | 'outline' }[] = [];

    if (userRole === 'gate') {
      if (currentStatus === 'entered' || currentStatus === 'gate_in') {
        buttons.push({ label: 'On The Way', status: 'on_the_way_store', icon: <Truck className="h-4 w-4" />, variant: 'default' });
      }
      if (currentStatus === 'gate_in') {
        buttons.push({ label: 'Gate OUT', status: 'gate_out', icon: <ArrowRightFromLine className="h-4 w-4" />, variant: 'destructive' });
      }
    }

    if (userRole === 'store') {
      if (currentStatus === 'on_the_way_store') {
        buttons.push({ label: 'Store Received', status: 'in_store', icon: <CheckCircle2 className="h-4 w-4" />, variant: 'default' });
      }
      if (currentStatus === 'in_store') {
        buttons.push({ label: 'Stock In Store', status: 'stock_in_store', icon: <Package className="h-4 w-4" />, variant: 'outline' });
        buttons.push({ label: 'Send to Dept', status: 'on_the_way_dept', icon: <Truck className="h-4 w-4" />, variant: 'default' });
        buttons.push({ label: 'Return to Gate', status: 'gate_in', icon: <ArrowLeftToLine className="h-4 w-4" />, variant: 'outline' });
      }
      if (currentStatus === 'stock_in_store') {
        buttons.push({ label: 'Send to Dept', status: 'on_the_way_dept', icon: <Truck className="h-4 w-4" />, variant: 'default' });
        buttons.push({ label: 'Return to Gate', status: 'gate_in', icon: <ArrowLeftToLine className="h-4 w-4" />, variant: 'outline' });
      }
    }

    if (userRole === 'department') {
      if (currentStatus === 'on_the_way_dept' || currentStatus === 'stock_in_store' || currentStatus === 'in_store') {
        buttons.push({ label: 'Dept Know', status: 'know_about', icon: <Eye className="h-4 w-4" />, variant: 'outline' });
        buttons.push({ label: 'Dept Received', status: 'received', icon: <CheckCircle2 className="h-4 w-4" />, variant: 'default' });
      }
      if (currentStatus === 'know_about') {
        buttons.push({ label: 'Dept Received', status: 'received', icon: <CheckCircle2 className="h-4 w-4" />, variant: 'default' });
      }
      // Department can return product to gate
      if (currentStatus !== 'entered' && currentStatus !== 'gate_in' && currentStatus !== 'gate_out') {
        buttons.push({ label: 'Return to Gate', status: 'gate_in', icon: <RotateCcw className="h-4 w-4" />, variant: 'destructive' });
      }
    }

    return buttons;
  };

  const actionButtons = getActionButtons();

  const getClickableStatuses = (): string[] => {
    // Clickable progress per page/role as requested
    // Gate: 2 steps (entered → on_the_way_store)
    // Store: 3 steps (in_store, stock_in_store, on_the_way_dept)
    // Department: 2 steps (know_about, received)
    if (userRole === 'gate') {
      if (currentStatus === 'entered' || currentStatus === 'gate_in') return ['on_the_way_store'];
      return [];
    }

    if (userRole === 'store') {
      const clickable: string[] = [];
      if (currentStatus === 'on_the_way_store') clickable.push('in_store');
      if (currentStatus === 'in_store') clickable.push('stock_in_store', 'on_the_way_dept');
      if (currentStatus === 'stock_in_store') clickable.push('on_the_way_dept');
      return clickable;
    }

    if (userRole === 'department') {
      const clickable: string[] = [];
      if (currentStatus === 'stock_in_store' || currentStatus === 'in_store') clickable.push('know_about');
      if (currentStatus === 'on_the_way_dept') clickable.push('know_about', 'received');
      if (currentStatus === 'know_about') clickable.push('received');
      return clickable;
    }

    return [];
  };

  const clickableStatuses = getClickableStatuses();

  return (
    <>
      <div
        ref={cardRef}
        className={`group flex flex-col h-full p-2.5 sm:p-4 rounded-xl border ${borderClass} bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer`}
        onClick={handleOpenDetail}
      >
        {/* Delivery Progress (top, realtime + clickable) */}
        <div className="mb-2 sm:mb-3 rounded-xl bg-muted/20 border border-border/60 px-2 sm:px-3 py-1.5 sm:py-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-[9px] sm:text-[11px] font-medium text-muted-foreground mb-1 sm:mb-1.5">Delivery Progress</p>
          <ProductFlowProgress
            currentStatus={currentStatus}
            onStepClick={(status) => updateProductStatus(status)}
            clickableStatuses={clickableStatuses}
            disabled={updating}
          />
        </div>

        {/* Entity Hierarchy - Gate > Store > Department */}
        {(product.gates?.name || product.stores?.name || product.departments?.name) && (
          <div className="mb-2 sm:mb-3 p-1.5 sm:p-2 rounded-lg bg-gradient-to-r from-blue-500/8 via-purple-500/8 to-amber-500/8 border border-border/50">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap text-[10px] sm:text-xs">
              {/* Gate page: Show Store > Department (hide Gate) */}
              {userRole === 'gate' && (
                <>
                  {product.stores?.name && (
                    <>
                      <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-emerald-500/10">
                        <Building2 className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="font-semibold text-emerald-700 truncate text-[10px] sm:text-xs">{product.stores.name}</span>
                      </div>
                      {product.departments?.name && (
                        <ChevronRight className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-muted-foreground/40 flex-shrink-0" />
                      )}
                    </>
                  )}
                  
                  {product.departments?.name && (
                    <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-amber-500/10">
                      <Users className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-amber-600 flex-shrink-0" />
                      <span className="font-semibold text-amber-700 truncate text-[10px] sm:text-xs">{product.departments.name}</span>
                    </div>
                  )}
                </>
              )}

              {/* Other pages: Show Gate > Store > Department */}
              {userRole !== 'gate' && (
                <>
                  {product.gates?.name && (
                    <>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10">
                        <DoorOpen className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                        <span className="font-semibold text-blue-700 truncate">{product.gates.name}</span>
                      </div>
                      {(product.stores?.name || product.departments?.name) && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                      )}
                    </>
                  )}
                  
                  {product.stores?.name && (
                    <>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10">
                        <Building2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="font-semibold text-emerald-700 truncate">{product.stores.name}</span>
                      </div>
                      {product.departments?.name && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                      )}
                    </>
                  )}
                  
                  {product.departments?.name && (
                    <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-amber-500/10">
                      <Users className="h-2.5 sm:h-3.5 w-2.5 sm:w-3.5 text-amber-600 flex-shrink-0" />
                      <span className="font-semibold text-amber-700 truncate text-[10px] sm:text-xs">{product.departments.name}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 sm:gap-3">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-12 sm:h-14 lg:h-16 w-12 sm:w-14 lg:w-16 rounded-lg object-cover flex-shrink-0 ring-2 ring-border group-hover:ring-primary/30 transition-all"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h4 className="font-semibold text-foreground truncate text-xs sm:text-sm lg:text-base">{product.name}</h4>
              <ProductStatusBadge status={currentStatus} />
            </div>
            
            <p className="text-[9px] sm:text-xs lg:text-sm text-muted-foreground mt-1 sm:mt-2">
              Qty: {product.quantity}
              {product.sender_name && ` • From: ${product.sender_name}`}
              {product.sender_company && ` (${product.sender_company})`}
              {product.receiver_name && ` → ${product.receiver_name}`}
              {product.receiver_company && ` (${product.receiver_company})`}
            </p>
            {/* Show individual items */}
            {product.product_items && product.product_items.length > 0 && (
              <div className="mt-1 sm:mt-1.5 space-y-0.5">
                {product.product_items.map((item, idx) => (
                  <p key={item.id} className="text-[8px] sm:text-[10px] text-muted-foreground pl-1.5 sm:pl-2 border-l-2 border-primary/30">
                    {idx + 1}. {item.name} × {item.quantity}
                  </p>
                ))}
              </div>
            )}
            {/* Created time */}
            <p className="text-[8px] sm:text-[10px] text-muted-foreground mt-1 sm:mt-2 flex items-center gap-1">
              <Clock className="h-2 sm:h-3 w-2 sm:w-3" />
              {format(new Date(product.created_at), 'dd MMM yyyy, h:mm a')}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border flex-wrap gap-1 sm:gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <ChatButton
              officeId={product.office_id}
              productId={product.id}
              currentUserId={userId}
              onClick={handleOpenChat}
            />


            {/* WhatsApp Icons - Separate for each entity */}
            {(() => {
              const waEntries: { label: string; number: string; color: string }[] = [];
              
              // Show all WhatsApp numbers only on gate page
              if (userRole === 'gate') {
                // Department WhatsApp numbers: hide the first number used for ready notification,
                // but keep any remaining numbers available from the entry card.
                const departmentNumbers = getWhatsAppNumbers(product.departments?.whatsapp_number);
                const visibleDepartmentNumbers = departmentNumbers.slice(1);
                visibleDepartmentNumbers.forEach((num) => {
                  waEntries.push({ label: 'Dept', number: num, color: 'from-amber-500 to-orange-500' });
                });

                // Store WhatsApp numbers remain visible
                const storeNumbers = getWhatsAppNumbers(product.stores?.whatsapp_number);
                storeNumbers.forEach((num) => {
                  waEntries.push({ label: 'Store', number: num, color: 'from-emerald-500 to-teal-500' });
                });
              }

              if (waEntries.length === 0) return null;

              const message = encodeURIComponent(
                ` ${product.name}\n Qty: ${product.quantity}\n Sender: ${product.sender_name || 'N/A'}\n Receiver: ${product.receiver_name || 'N/A'}\n Dept: ${product.departments?.name || 'N/A'}\n Gate: ${product.gates?.name || 'N/A'}`
              );

              // On mobile, use dropdown; on desktop, show inline buttons
              const isMobile = window.innerWidth < 768;

              if (isMobile && waEntries.length > 1) {
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 sm:h-8 gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-2"
                      >
                        <MessageCircle className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {waEntries.map((entry, idx) => {
                        let cleanNumber = entry.number.replace(/[^0-9]/g, '');
                        if (cleanNumber.startsWith('0')) cleanNumber = '880' + cleanNumber.substring(1);
                        return (
                          <DropdownMenuItem key={idx} asChild>
                            <a
                              href={`https://wa.me/${cleanNumber}?text=${message}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleWhatsAppClick(cleanNumber)}
                              className={`flex items-center gap-2 cursor-pointer rounded-md px-2 py-2 transition-colors ${clickedWhatsAppNumbers.includes(cleanNumber) ? 'bg-slate-700 text-white' : 'hover:bg-muted/80 text-foreground'}`}
                            >
                              <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${entry.color}`} />
                              <span>{entry.label}: {entry.number}</span>
                            </a>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              // Desktop: show inline buttons
              return waEntries.map((entry, idx) => {
                let cleanNumber = entry.number.replace(/[^0-9]/g, '');
                if (cleanNumber.startsWith('0')) cleanNumber = '880' + cleanNumber.substring(1);
                const isClicked = clickedWhatsAppNumbers.includes(cleanNumber);
                return (
                  <a
                    key={idx}
                    href={`https://wa.me/${cleanNumber}?text=${message}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleWhatsAppClick(cleanNumber)}
                    className={`flex items-center justify-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 font-semibold transition-all shadow-sm h-7 sm:h-8 ${isClicked ? 'bg-slate-700 text-white border border-slate-500' : `text-white bg-gradient-to-r ${entry.color}`} hover:shadow-md`}
                    title={`${entry.label}: ${entry.number}`}
                  >
                    <MessageCircle className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                    <span className="text-[8px] sm:text-[10px]">{entry.label}</span>
                  </a>
                );
              });
            })()}

            {/* Edit Button */}
            {showEditButton && onEdit && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 sm:h-8 gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-2"
                onClick={onEdit}
              >
                <Pencil className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
            {/* Delete Button */}
            {showDeleteButton && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 sm:h-8 w-7 sm:w-8 p-0 text-destructive hover:text-destructive"
                onClick={async () => {
                  if (!window.confirm('Are you sure you want to delete this entry?')) return;
                  try {
                    const { error } = await supabase.from('products').delete().eq('id', product.id);
                    if (error) throw error;
                    toast.success('Entry deleted');
                    onStatusUpdate?.();
                  } catch (error) {
                    toast.error('Failed to delete');
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {/* Undo Button - shows for 5 seconds after an action */}
            {showUndoToast && lastAction && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs border-warning text-warning hover:bg-warning/10 animate-pulse"
                onClick={handleUndo}
                disabled={updating}
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Undo</span>
              </Button>
            )}
          </div>

          {actionButtons.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {actionButtons.slice(0, 2).map((btn) => (
                <Button
                  key={btn.status}
                  size="sm"
                  variant={btn.variant}
                  className="h-8 gap-1 text-[10px] sm:text-xs sm:gap-1.5"
                  onClick={() => updateProductStatus(btn.status)}
                  disabled={updating}
                >
                  {updating ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" /> : btn.icon}
                  <span className="hidden xs:inline sm:inline">{btn.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] lg:max-h-[85vh] flex flex-col p-3 sm:p-6 gap-3 sm:gap-4 scrollbar-hide overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Package className="h-4 sm:h-5 w-4 sm:w-5 text-primary flex-shrink-0" />
              <span className="truncate">Product Details</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-5 py-2 flex-1 overflow-y-auto scrollbar-hide">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full rounded-xl aspect-video object-cover shadow-md"
              />
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
              <h3 className="font-bold text-base sm:text-lg text-foreground truncate flex-1">{product.name}</h3>
              <ProductStatusBadge status={currentStatus} />
            </div>

            {/* Clickable Flow Progress */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/2 rounded-xl p-2.5 sm:p-4 border border-primary/10" onClick={(e) => e.stopPropagation()}>
              <p className="text-[10px] sm:text-xs font-semibold text-primary mb-2 sm:mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                Delivery Progress (Click to update)
              </p>
              <ProductFlowProgress
                currentStatus={currentStatus}
                onStepClick={(status) => updateProductStatus(status)}
                clickableStatuses={clickableStatuses}
                disabled={updating}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
              <div className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-primary/8 to-primary/4 border border-primary/10">
                <p className="text-[9px] sm:text-xs text-muted-foreground font-semibold tracking-wide">QUANTITY</p>
                <p className="font-semibold text-foreground mt-0.5 sm:mt-1 text-sm">{product.quantity}</p>
              </div>
              {product.sender_name && (
                <div className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-success/8 to-success/4 border border-success/10">
                  <p className="text-[9px] sm:text-xs text-muted-foreground font-semibold tracking-wide">SENDER</p>
                  <p className="font-semibold text-foreground mt-0.5 sm:mt-1 text-sm truncate">{product.sender_name}</p>
                </div>
              )}
              {product.receiver_name && (
                <div className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-warning/8 to-warning/4 border border-warning/10">
                  <p className="text-[9px] sm:text-xs text-muted-foreground font-semibold tracking-wide">RECEIVER</p>
                  <p className="font-semibold text-foreground mt-0.5 sm:mt-1 text-sm truncate">{product.receiver_name}</p>
                </div>
              )}
              {product.sender_company && (
                <div className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-info/8 to-info/4 border border-info/10">
                  <p className="text-[9px] sm:text-xs text-muted-foreground font-semibold tracking-wide">FROM</p>
                  <p className="font-semibold text-foreground mt-0.5 sm:mt-1 text-sm truncate">{product.sender_company}</p>
                </div>
              )}
              {product.receiver_company && (
                <div className="p-2 sm:p-3 rounded-lg bg-gradient-to-br from-destructive/8 to-destructive/4 border border-destructive/10">
                  <p className="text-[9px] sm:text-xs text-muted-foreground font-semibold tracking-wide">TO</p>
                  <p className="font-semibold text-foreground mt-0.5 sm:mt-1 text-sm truncate">{product.receiver_company}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {actionButtons.length > 0 && (
              <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                {actionButtons.map(btn => (
                  <Button
                    key={btn.status}
                    variant={btn.variant}
                    className="flex-1 min-w-[100px] sm:min-w-[120px] h-8 sm:h-10 text-xs sm:text-sm gap-1 sm:gap-2"
                    onClick={() => updateProductStatus(btn.status)}
                    disabled={updating}
                  >
                    {updating ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : btn.icon}
                    <span className="hidden xs:inline">{btn.label}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Chat Button */}
            <div onClick={(e) => e.stopPropagation()}>
              <ChatButton
                officeId={product.office_id}
                productId={product.id}
                currentUserId={userId}
                onClick={handleOpenChat}
                variant="outline"
                size="default"
                className="w-full h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>

            {/* Timeline */}
            <div className="bg-gradient-to-br from-primary/5 to-transparent rounded-xl p-2.5 sm:p-4 border border-primary/10">
              <h4 className="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-xs sm:text-sm">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Live Timeline
              </h4>
              <ProductFlowTimeline events={timeline} currentStatus={currentStatus} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      {userId && (
        <ChatDialog
          open={showChat}
          onOpenChange={setShowChat}
          officeId={product.office_id}
          productId={product.id}
          currentUserId={userId}
          currentUserRole={userRole}
          currentUserName={userName}
          title={`Chat: ${product.name}`}
        />
      )}
    </>
  );
};

export default ProductCard;
