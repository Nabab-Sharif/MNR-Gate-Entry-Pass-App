import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Package, Clock, AlertCircle, TrendingUp, FileText, Camera, Users } from 'lucide-react';

export interface MobileStatsMenuProps {
  totalEntries: number;
  todayEntries: number;
  pendingEntries: number;
  totalPasses: number;
  todayPasses: number;
  pendingPasses: number;
  onSelectStat: (
    type: 'total-entries' | 'today-entries' | 'pending-entries' | 'total-passes' | 'today-passes' | 'pending-passes'
  ) => void;
  onSelectTab?: (tab: string) => void;
  tabs?: { value: string; label: string; icon?: React.ReactNode }[];
  infoItems?: { label: string; value: string | number; icon?: React.ReactNode }[];
}

const StatRow: React.FC<{
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, value, color, icon, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 hover:border-primary hover:bg-accent transition-all ${color}`}
  >
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-md bg-background/60">{icon}</div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
    <span className="text-lg font-bold text-foreground">{value}</span>
  </button>
);

const MobileStatsMenu: React.FC<MobileStatsMenuProps> = ({
  totalEntries,
  todayEntries,
  pendingEntries,
  totalPasses,
  todayPasses,
  pendingPasses,
  onSelectStat,
  onSelectTab,
  tabs,
  infoItems,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleStat = (t: Parameters<MobileStatsMenuProps['onSelectStat']>[0]) => {
    setOpen(false);
    setTimeout(() => onSelectStat(t), 50);
  };

  const handleTab = (v: string) => {
    setOpen(false);
    setTimeout(() => onSelectTab?.(v), 50);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-xs p-4 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Quick Stats</SheetTitle>
        </SheetHeader>

        <div className="space-y-2">
          {infoItems && infoItems.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Overview</p>
              <div className="grid grid-cols-3 gap-2">
                {infoItems.map((it) => (
                  <div key={it.label} className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border/50 bg-accent/30">
                    {it.icon}
                    <span className="text-[10px] text-muted-foreground">{it.label}</span>
                    <span className="text-sm font-bold text-foreground truncate max-w-full">{it.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Entries</p>
          <StatRow label="Total Entry" value={totalEntries} color="bg-sky-500/5"
            icon={<Package className="h-4 w-4 text-sky-600" />}
            onClick={() => handleStat('total-entries')} />
          <StatRow label="Today Entry" value={todayEntries} color="bg-violet-500/5"
            icon={<Clock className="h-4 w-4 text-violet-600" />}
            onClick={() => handleStat('today-entries')} />
          <StatRow label="Pending Entry" value={pendingEntries} color="bg-warning/5"
            icon={<AlertCircle className="h-4 w-4 text-warning" />}
            onClick={() => handleStat('pending-entries')} />

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-3">Passes</p>
          <StatRow label="Total Pass" value={totalPasses} color="bg-primary/5"
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            onClick={() => handleStat('total-passes')} />
          <StatRow label="Today Pass" value={todayPasses} color="bg-blue-500/5"
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            onClick={() => handleStat('today-passes')} />
          <StatRow label="Pending Pass" value={pendingPasses} color="bg-destructive/5"
            icon={<AlertCircle className="h-4 w-4 text-destructive" />}
            onClick={() => handleStat('pending-passes')} />

          {tabs && tabs.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-3">Navigate</p>
              <div className="grid grid-cols-2 gap-2">
                {tabs.map(t => (
                  <Button
                    key={t.value}
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => handleTab(t.value)}
                  >
                    {t.icon}
                    <span className="text-xs">{t.label}</span>
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileStatsMenu;
