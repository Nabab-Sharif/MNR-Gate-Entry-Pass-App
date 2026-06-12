import React from 'react';
import { 
  CheckCircle2, 
  Truck, 
  DoorOpen, 
  Store, 
  Users,
  Package,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  status: string;
  action_by_name: string | null;
  action_role: string | null;
  created_at: string;
}

interface ProductFlowTimelineProps {
  events: TimelineEvent[];
  currentStatus: string;
}

type ProductRole = 'gate' | 'store' | 'department';

export const flowSteps: Array<{ status: string; label: string; icon: any; role: ProductRole }> = [
  { status: 'entered', label: 'Gate Entry', icon: DoorOpen, role: 'gate' },
  { status: 'on_the_way_store', label: 'On The Way', icon: Truck, role: 'gate' },
  { status: 'in_store', label: 'Store Received', icon: Store, role: 'store' },
  { status: 'stock_in_store', label: 'Stock In Store', icon: Package, role: 'store' },
  { status: 'on_the_way_dept', label: 'Sending to Dept', icon: Truck, role: 'store' },
  { status: 'know_about', label: 'Dept Know', icon: Users, role: 'department' },
  { status: 'received', label: 'Dept Received', icon: CheckCircle2, role: 'department' },
];

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  entered: { label: 'Gate Entry', color: 'text-info', bgColor: 'bg-info' },
  on_the_way_store: { label: 'On The Way', color: 'text-warning', bgColor: 'bg-warning' },
  in_store: { label: 'Store Received', color: 'text-success', bgColor: 'bg-success' },
  stock_in_store: { label: 'Stock In Store', color: 'text-success', bgColor: 'bg-success' },
  on_the_way_dept: { label: 'Sending to Dept', color: 'text-warning', bgColor: 'bg-warning' },
  know_about: { label: 'Dept Know', color: 'text-info', bgColor: 'bg-info' },
  gate_in: { label: 'Gate IN', color: 'text-info', bgColor: 'bg-info' },
  gate_out: { label: 'Gate OUT', color: 'text-destructive', bgColor: 'bg-destructive' },
  received: { label: 'Dept Received', color: 'text-success', bgColor: 'bg-success' },
};

export const getProductStatusConfig = (status: string) => {
  return statusConfig[status] || { label: status, color: 'text-muted-foreground', bgColor: 'bg-muted' };
};

export const ProductStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = getProductStatusConfig(status);
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full",
      config.bgColor + "/10",
      config.color,
      "border border-current/20"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.bgColor)} />
      {config.label}
    </span>
  );
};

// Visual flow progress bar (optionally clickable) - Mobile responsive with realtime animations
export const ProductFlowProgress: React.FC<{
  currentStatus: string;
  onStepClick?: (status: string) => void;
  clickableStatuses?: string[];
  disabled?: boolean;
  allowUndo?: boolean;
}> = ({ currentStatus, onStepClick, clickableStatuses, disabled, allowUndo = true }) => {
  const currentIndex = flowSteps.findIndex(s => s.status === currentStatus);
  const completedSteps = currentIndex >= 0 ? currentIndex + 1 : 0;

  return (
    <div className="w-full py-1.5 sm:py-2 lg:py-3 overflow-hidden">
      <div className="flex items-center justify-between relative px-1 sm:px-2">
        {/* Progress line background */}
        <div className="absolute left-1 right-1 sm:left-2 sm:right-2 top-1/2 h-[2px] sm:h-[3px] lg:h-1 bg-border -translate-y-1/2 rounded-full" />

        {/* Progress line filled with glow */}
        <div
          className="absolute left-1 sm:left-2 top-1/2 h-[2px] sm:h-[3px] lg:h-1 bg-gradient-to-r from-primary via-success to-success -translate-y-1/2 rounded-full transition-all duration-700 shadow-lg shadow-primary/30"
          style={{ width: `calc(${(completedSteps / flowSteps.length) * 100}% - 2px)` }}
        />

        {/* Steps */}
        <div className="flex items-center justify-between w-full relative z-10">
          {flowSteps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentIndex >= index;
            const isCurrent = currentStatus === step.status;
            const isClickable =
              !!onStepClick &&
              !disabled &&
              (
                (clickableStatuses || []).includes(step.status) ||
                (allowUndo && isCompleted && index === currentIndex - 1 && currentIndex > 0)
              ) &&
              step.status !== currentStatus;
            
            const isUndoStep = allowUndo && isCompleted && index === currentIndex - 1 && currentIndex > 0;

            return (
              <button
                key={step.status}
                type="button"
                onClick={() => isClickable && onStepClick?.(step.status)}
                className={cn(
                  "relative flex flex-col items-center group/step flex-1",
                  isClickable ? "cursor-pointer" : "cursor-default",
                  disabled && "opacity-60"
                )}
                aria-label={`Set status: ${step.label}`}
                disabled={!isClickable}
              >
                <div
                  className={cn(
                    "w-4 h-4 sm:w-6 sm:h-6 lg:w-9 lg:h-9 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0",
                    isCompleted
                      ? "bg-gradient-to-br from-primary to-success text-primary-foreground shadow-lg shadow-success/50"
                      : isCurrent
                      ? "bg-card border-2 border-primary text-primary shadow-md shadow-primary/40 animate-pulse-glow"
                      : "bg-card border-2 border-border text-muted-foreground",
                    isCurrent && "ring-2 sm:ring-3 lg:ring-4 ring-primary/40 scale-105 sm:scale-110 lg:scale-110",
                    isClickable && !isUndoStep && "hover:scale-110 sm:hover:scale-125 lg:hover:scale-125 hover:ring-2 sm:hover:ring-3 lg:hover:ring-4 hover:ring-warning/60 hover:border-warning hover:shadow-lg hover:shadow-warning/40",
                    isClickable && isUndoStep && "hover:scale-105 sm:hover:scale-110 lg:hover:scale-110 hover:ring-2 sm:hover:ring-3 lg:hover:ring-4 hover:ring-destructive/60 hover:border-destructive hover:shadow-lg hover:shadow-destructive/40"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-2 w-2 sm:h-3 sm:w-3 lg:h-4 lg:w-4" />
                  ) : (
                    <Icon className="h-2 w-2 sm:h-3 sm:w-3 lg:h-4 lg:w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[6px] sm:text-[8px] lg:text-[9px] mt-1 sm:mt-1.5 lg:mt-2 text-center max-w-[32px] sm:max-w-[55px] lg:max-w-[70px] font-medium leading-tight line-clamp-2",
                    isCompleted ? "text-foreground" : isCurrent ? "text-primary font-bold" : "text-muted-foreground",
                    isClickable && "group-hover/step:font-bold transition-all"
                  )}
                >
                  {step.label}
                </span>
                {isClickable && (
                  <span className={cn(
                    "absolute top-full mt-1 sm:mt-1.5 text-[4px] sm:text-[5px] lg:text-[6px] font-bold opacity-0 group-hover/step:opacity-100 transition-opacity whitespace-nowrap",
                    isUndoStep ? "text-destructive" : "text-warning"
                  )}>
                    {isUndoStep ? "Undo" : "Click!"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ProductFlowTimeline: React.FC<ProductFlowTimelineProps> = ({ events, currentStatus }) => {
  if (events.length === 0) {
    return (
      <div className="text-center py-4 sm:py-6 text-xs sm:text-sm text-muted-foreground">
        <Package className="h-6 sm:h-8 w-6 sm:w-8 mx-auto mb-2 opacity-30" />
        No timeline events yet
      </div>
    );
  }

  return (
    <div className="space-y-1 sm:space-y-2">
      {events.map((event, index) => {
        const config = getProductStatusConfig(event.status);
        const isLatest = index === 0;
        
        return (
          <div 
            key={event.id}
            className={cn(
              "relative flex gap-2 sm:gap-3 py-2 px-2 sm:px-3 rounded-lg transition-all duration-300",
              isLatest && "bg-primary/8 border border-primary/20 animate-pulse-subtle"
            )}
          >
            {/* Timeline line */}
            {index < events.length - 1 && (
              <div className="absolute left-[13px] sm:left-[15px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
            )}
            
            {/* Status dot with glow */}
            <div className={cn(
              "flex-shrink-0 w-6 sm:w-7 h-6 sm:h-7 rounded-full flex items-center justify-center relative",
              config.bgColor + "/20",
              "border-2",
              isLatest ? "border-primary shadow-lg shadow-primary/40" : "border-transparent"
            )}>
              <div className={cn("w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full", config.bgColor)} />
              {isLatest && (
                <div className={cn("absolute inset-0 rounded-full border-2 animate-pulse-ring", config.bgColor + " border-opacity-30")} />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <span className={cn("font-semibold text-xs sm:text-sm", config.color)}>
                  {config.label}
                </span>
                {isLatest && (
                  <span className="text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold animate-pulse">
                    Now
                  </span>
                )}
              </div>
              <div className="text-[8px] sm:text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-1">
                <span className="font-medium">{event.action_by_name || 'System'}</span>
                <span>•</span>
                <span className="text-muted-foreground/70">{event.action_role}</span>
                <span>•</span>
                <span className="text-muted-foreground/70">{format(new Date(event.created_at), 'MMM d, h:mm a')}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductFlowTimeline;
