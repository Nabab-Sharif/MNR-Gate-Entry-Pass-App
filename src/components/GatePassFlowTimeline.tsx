import React from 'react';
import { 
  CheckCircle2, 
  Truck, 
  DoorOpen, 
  Store, 
  Users,
  Package,
  ArrowRightFromLine,
  ArrowLeftToLine
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

// Department creates gate pass flow
const deptFlowSteps = [
  { status: 'created', label: 'Created', icon: Package, role: 'department' },
  { status: 'store_check', label: 'Store Check', icon: Store, role: 'store' },
  { status: 'ready_gate_pass', label: 'Ready', icon: CheckCircle2, role: 'store' },
  { status: 'on_the_way_gate', label: 'To Gate', icon: Truck, role: 'store' },
  { status: 'gate_received', label: 'Gate Received', icon: DoorOpen, role: 'gate' },
  { status: 'gate_in', label: 'Gate IN', icon: ArrowLeftToLine, role: 'gate' },
  { status: 'gate_out', label: 'Gate OUT', icon: ArrowRightFromLine, role: 'gate' },
];

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  'created': { label: 'Created', color: 'text-info', bgColor: 'bg-info', icon: <Package className="h-4 w-4" /> },
  'store_check': { label: 'Store Checking', color: 'text-warning', bgColor: 'bg-warning', icon: <Store className="h-4 w-4" /> },
  'ready_gate_pass': { label: 'Ready for Gate', color: 'text-success', bgColor: 'bg-success', icon: <CheckCircle2 className="h-4 w-4" /> },
  'on_the_way_gate': { label: 'On The Way Gate', color: 'text-warning', bgColor: 'bg-warning', icon: <Truck className="h-4 w-4" /> },
  'gate_received': { label: 'Gate Received', color: 'text-primary', bgColor: 'bg-primary', icon: <DoorOpen className="h-4 w-4" /> },
  'on_the_way_store': { label: 'On The Way Store', color: 'text-warning', bgColor: 'bg-warning', icon: <Truck className="h-4 w-4" /> },
  'store_received': { label: 'Store Received', color: 'text-success', bgColor: 'bg-success', icon: <Store className="h-4 w-4" /> },
  'on_the_way_dept': { label: 'On The Way Dept', color: 'text-warning', bgColor: 'bg-warning', icon: <Truck className="h-4 w-4" /> },
  'dept_received': { label: 'Dept Received', color: 'text-success', bgColor: 'bg-success', icon: <Users className="h-4 w-4" /> },
  'gate_in': { label: 'Gate IN', color: 'text-info', bgColor: 'bg-info', icon: <ArrowLeftToLine className="h-4 w-4" /> },
  'gate_out': { label: 'Gate OUT', color: 'text-destructive', bgColor: 'bg-destructive', icon: <ArrowRightFromLine className="h-4 w-4" /> },
  'pending': { label: 'Pending', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: <Package className="h-4 w-4" /> },
};

export const getGatePassStatusConfig = (status: string) => {
  return statusConfig[status?.toLowerCase()] || statusConfig['pending'];
};

export const GatePassStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = getGatePassStatusConfig(status);
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full",
      config.bgColor + "/10",
      config.color,
      "border border-current/20"
    )}>
      {config.icon}
      {config.label}
    </span>
  );
};

// Visual horizontal flow - CLICKABLE
interface GatePassFlowProgressProps {
  currentStatus: string;
  createdBy: 'department' | 'store';
  onStepClick?: (status: string) => void;
  clickableStatuses?: string[];
  disabled?: boolean;
}

export const GatePassFlowProgress: React.FC<GatePassFlowProgressProps> = ({ 
  currentStatus, 
  createdBy, 
  onStepClick, 
  clickableStatuses = [],
  disabled = false
}) => {
  // Different flow based on who created it
  const flowSteps = createdBy === 'department' 
    ? [
        { status: 'created', label: 'Created', icon: Package },
        { status: 'store_check', label: 'Store Check', icon: Store },
        { status: 'ready_gate_pass', label: 'Ready', icon: CheckCircle2 },
        { status: 'on_the_way_gate', label: 'To Gate', icon: Truck },
        { status: 'gate_received', label: 'At Gate', icon: DoorOpen },
        { status: 'gate_out', label: 'Gate OUT', icon: ArrowRightFromLine },
      ]
    : [
        { status: 'created', label: 'Created', icon: Package },
        { status: 'on_the_way_gate', label: 'To Gate', icon: Truck },
        { status: 'gate_received', label: 'At Gate', icon: DoorOpen },
        { status: 'gate_in', label: 'Gate IN', icon: ArrowLeftToLine },
        { status: 'on_the_way_store', label: 'To Store', icon: Truck },
        { status: 'store_received', label: 'Store OK', icon: Store },
      ];

  const currentIndex = flowSteps.findIndex(s => s.status === currentStatus?.toLowerCase());
  
  const handleClick = (status: string) => {
    if (!disabled && clickableStatuses.includes(status) && onStepClick) {
      onStepClick(status);
    }
  };

  return (
    <div className="w-full py-1.5 sm:py-2 lg:py-4 overflow-hidden">
      <div className="flex items-center justify-between min-w-full relative px-1 sm:px-2">
        {/* Progress line background */}
        <div className="absolute left-1 right-1 sm:left-2 sm:right-2 top-1/2 h-[2px] sm:h-[3px] lg:h-1 bg-border -translate-y-1/2 rounded-full" />
        
        {/* Progress line filled with glow */}
        <div 
          className="absolute left-1 sm:left-2 top-1/2 h-[2px] sm:h-[3px] lg:h-1 bg-gradient-to-r from-primary via-success to-success -translate-y-1/2 rounded-full transition-all duration-700 shadow-lg shadow-primary/30"
          style={{ width: currentIndex >= 0 ? `calc(${((currentIndex + 1) / flowSteps.length) * 100}% - 2px)` : '0%' }}
        />
        
        {/* Steps */}
        {flowSteps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = currentIndex >= index;
          const isCurrent = currentStatus?.toLowerCase() === step.status;
          const isClickable = !disabled && clickableStatuses.includes(step.status);
          
          return (
            <div 
              key={step.status} 
              className={cn(
                "relative flex flex-col items-center flex-1 group",
                isClickable && "cursor-pointer"
              )}
              onClick={() => handleClick(step.status)}
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
                  isClickable && "hover:scale-110 sm:hover:scale-125 lg:hover:scale-125 hover:ring-2 sm:hover:ring-3 lg:hover:ring-4 hover:ring-warning/60 hover:border-warning hover:shadow-lg hover:shadow-warning/40"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-2 w-2 sm:h-3 sm:w-3 lg:h-4 lg:w-4" />
                ) : (
                  <Icon className="h-2 w-2 sm:h-3 sm:w-3 lg:h-4 lg:w-4" />
                )}
              </div>
              <span className={cn(
                "text-[6px] sm:text-[8px] lg:text-[9px] mt-1 sm:mt-1.5 lg:mt-2 text-center max-w-[30px] sm:max-w-[45px] lg:max-w-[55px] font-medium leading-tight line-clamp-2",
                isCompleted ? "text-foreground" : isCurrent ? "text-primary font-bold" : "text-muted-foreground",
                isClickable && "group-hover:text-warning group-hover:font-bold transition-all"
              )}>
                {step.label}
              </span>
              {isClickable && (
                <span className="absolute top-full mt-1 sm:mt-1.5 text-[4px] sm:text-[5px] lg:text-[6px] text-warning font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Click!
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GatePassFlowTimeline: React.FC<{ events: TimelineEvent[]; currentStatus: string }> = ({ events, currentStatus }) => {
  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
        No timeline events yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event, index) => {
        const config = getGatePassStatusConfig(event.status);
        const isLatest = index === 0;
        
        return (
          <div 
            key={event.id}
            className={cn(
              "relative flex gap-3 py-2",
              isLatest && "bg-primary/5 -mx-2 px-2 rounded-lg"
            )}
          >
            {/* Timeline line */}
            {index < events.length - 1 && (
              <div className="absolute left-[15px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-border to-transparent" />
            )}
            
            {/* Icon */}
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
              config.bgColor + "/20",
              "border",
              isLatest ? "border-primary" : "border-transparent"
            )}>
              <span className={config.color}>{config.icon}</span>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("font-medium text-sm", config.color)}>
                  {config.label}
                </span>
                {isLatest && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Latest
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {event.action_by_name || 'System'} • {event.action_role} • {format(new Date(event.created_at), 'MMM d, h:mm a')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GatePassFlowTimeline;
