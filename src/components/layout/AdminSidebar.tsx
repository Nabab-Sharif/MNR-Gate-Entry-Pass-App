import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Building2, 
  LayoutDashboard, 
  DoorOpen, 
  Store, 
  Users, 
  Settings,
  ChevronRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Offices / Units', path: '/admin/offices', icon: <Building2 className="h-5 w-5" /> },
  { label: 'All Gates', path: '/admin/gates', icon: <DoorOpen className="h-5 w-5" /> },
  { label: 'All Stores', path: '/admin/stores', icon: <Store className="h-5 w-5" /> },
  { label: 'All Departments', path: '/admin/departments', icon: <Users className="h-5 w-5" /> },
  { label: 'Settings', path: '/admin/settings', icon: <Settings className="h-5 w-5" /> },
];

const AdminSidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/admin' && location.pathname.startsWith(item.path));
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "sidebar-item group",
                  isActive && "active"
                )}
              >
                <span className={cn(
                  "transition-colors",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"
                )}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight className="h-4 w-4 text-sidebar-primary opacity-70" />
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="rounded-lg bg-sidebar-accent/50 p-3">
          <p className="text-xs text-sidebar-foreground/70">System Status</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-sidebar-foreground">All Systems Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;
