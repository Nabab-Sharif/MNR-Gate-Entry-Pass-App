import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Menu, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', path: '/sub-admin', icon: LayoutDashboard },
];

const SubAdminSidebar: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <nav className="px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || (item.path !== '/sub-admin' && pathname.startsWith(item.path));
          return (
            <NavLink key={item.path} to={item.path} className={cn('sidebar-item group', isActive && 'active')}>
              <span className={cn('transition-colors', isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/70')}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="h-4 w-4 text-sidebar-primary opacity-70" />}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

const SubAdminMobileMenu: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const { pathname } = useLocation();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-xs p-4 overflow-y-auto">
        <SheetHeader className="mb-4"><SheetTitle>Sub Admin Menu</SheetTitle></SheetHeader>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || (item.path !== '/sub-admin' && pathname.startsWith(item.path));
            return (
              <NavLink key={item.path} to={item.path} onClick={() => setOpen(false)}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')}>
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

const SubAdminLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex">
        <SubAdminSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="w-full py-4 px-2 sm:px-4 md:px-6 lg:px-8 animate-fade-in">
            <div className="lg:hidden mb-3 flex items-center gap-2">
              <SubAdminMobileMenu />
              <span className="text-sm font-medium text-muted-foreground">Menu</span>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default SubAdminLayout;
