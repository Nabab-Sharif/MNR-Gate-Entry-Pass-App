import React from 'react';
import { 
  CheckCircle2, 
  Truck, 
  DoorOpen, 
  ArrowRightFromLine, 
  ArrowLeftToLine, 
  Store, 
  Package,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface TimelineEvent {
  id: string;
  status: string;
  action_by_name: string | null;
  action_role: string | null;
  created_at: string;
}

interface GatePassTimelineProps {
  events: TimelineEvent[];
  currentStatus: string;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  'created': { 
    label: 'Created', 
    icon: <Package className="h-4 w-4" />, 
    color: 'text-info',
    bgColor: 'bg-info/10 border-info/30'
  },
  'on_the_way_gate': { 
    label: 'On The Way Gate', 
    icon: <Truck className="h-4 w-4" />, 
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/30'
  },
  'gate_received': { 
    label: 'Gate Received', 
    icon: <DoorOpen className="h-4 w-4" />, 
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/30'
  },
  'gate_out': { 
    label: 'Gate OUT', 
    icon: <ArrowRightFromLine className="h-4 w-4" />, 
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/30'
  },
  'gate_in': { 
    label: 'Gate IN', 
    icon: <ArrowLeftToLine className="h-4 w-4" />, 
    color: 'text-success',
    bgColor: 'bg-success/10 border-success/30'
  },
  'on_the_way_store': { 
    label: 'On The Way Store', 
    icon: <Truck className="h-4 w-4" />, 
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/30'
  },
  'store_received': { 
    label: 'Store Received', 
    icon: <Store className="h-4 w-4" />, 
    color: 'text-success',
    bgColor: 'bg-success/10 border-success/30'
  },
  'pending': { 
    label: 'Pending', 
    icon: <Clock className="h-4 w-4" />, 
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary border-border'
  }
};

export const getStatusConfig = (status: string) => {
  return statusConfig[status.toLowerCase()] || statusConfig['pending'];
};

export const GatePassStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = getStatusConfig(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${config.bgColor} ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
};

const GatePassTimeline: React.FC<GatePassTimelineProps> = ({ events, currentStatus }) => {
  if (events.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No timeline events yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => {
        const config = getStatusConfig(event.status);
        const isLatest = index === 0;
        
        return (
          <div 
            key={event.id}
            className={`relative flex gap-3 ${isLatest ? 'animate-slide-up' : ''}`}
          >
            {/* Timeline line */}
            {index < events.length - 1 && (
              <div className="absolute left-[18px] top-8 bottom-0 w-0.5 bg-border" />
            )}
            
            {/* Icon */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center border ${config.bgColor}`}>
              <span className={config.color}>{config.icon}</span>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-medium text-sm ${config.color}`}>
                  {config.label}
                </span>
                {isLatest && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                    Current
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{event.action_by_name || 'System'}</span>
                <span>•</span>
                <span className="capitalize">{event.action_role || 'system'}</span>
                <span>•</span>
                <span>{format(new Date(event.created_at), 'MMM d, h:mm a')}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GatePassTimeline;