import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import AdminSidebar from './AdminSidebar';
import AdminMobileMenu from './AdminMobileMenu';

const AdminLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="w-full py-4 px-2 sm:px-4 md:px-6 lg:px-8 animate-fade-in">
            <div className="lg:hidden mb-3 flex items-center gap-2">
              <AdminMobileMenu />
              <span className="text-sm font-medium text-muted-foreground">Menu</span>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
