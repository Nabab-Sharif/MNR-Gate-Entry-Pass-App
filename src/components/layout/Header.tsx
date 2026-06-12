import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import NotificationCenter from '@/components/NotificationCenter';

import ThemeSwitcher from '@/components/ThemeSwitcher';
import { LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.jpg';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('User');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;
      setUserName(user.user_metadata?.name || 'User');
      setUserRole(user.user_metadata?.role || '');
      setUserId(user.id);
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (roleRow?.role) setUserRole(roleRow.role);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="w-full flex h-16 items-center justify-between px-2 sm:px-4 md:px-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="MNR Group" className="h-10 w-10 rounded-full object-cover" />
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-foreground">MNR Group</h1>
            <p className="text-xs text-muted-foreground">Gate Entry/Pass Tracking System</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeSwitcher />
          <NotificationCenter userId={userId} showAll={userRole === 'sub_admin'} />
          
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50">
            <div className="icon-container-secondary !p-1.5 !rounded-full">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground">{userName}</p>
              {userRole && <p className="text-xs text-muted-foreground capitalize">{userRole}</p>}
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
