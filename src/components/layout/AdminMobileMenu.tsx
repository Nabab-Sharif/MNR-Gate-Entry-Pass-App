import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Menu,
  LayoutDashboard,
  Building2,
  DoorOpen,
  Store,
  Users,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Offices / Units', path: '/admin/offices', icon: Building2 },
  { label: 'All Gates', path: '/admin/gates', icon: DoorOpen },
  { label: 'All Stores', path: '/admin/stores', icon: Store },
  { label: 'All Departments', path: '/admin/departments', icon: Users },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

const AdminMobileMenu: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open admin menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-xs p-4 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Admin Menu</SheetTitle>
        </SheetHeader>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default AdminMobileMenu;
