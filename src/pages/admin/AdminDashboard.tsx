import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Building2, DoorOpen, Store, Users, TrendingUp, Activity, Clock, User, Package, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { format } from 'date-fns';

interface Office {
  id: string;
  name: string;
  location: string | null;
  status: string;
}

interface AdminSession {
  id: string;
  login_at: string;
  device_name: string | null;
  browser: string | null;
  profiles?: { name: string | null } | null;
}

interface Stats {
  totalOffices: number;
  activeOffices: number;
  totalGates: number;
  totalStores: number;
  totalDepartments: number;
  totalProducts: number;
  totalGatePasses: number;
}

const AdminDashboard: React.FC = () => {
  const [offices, setOffices] = useState<Office[]>([]);
  const [adminSessions, setAdminSessions] = useState<AdminSession[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOffices: 0,
    activeOffices: 0,
    totalGates: 0,
    totalStores: 0,
    totalDepartments: 0,
    totalProducts: 0,
    totalGatePasses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  // Real-time updates
  useRealtimeSubscription({
    table: 'offices',
    onInsert: () => fetchAllData(),
    onUpdate: () => fetchAllData(),
    onDelete: () => fetchAllData(),
    enabled: true,
  });

  useRealtimeSubscription({
    table: 'gates',
    onInsert: () => fetchAllData(),
    onDelete: () => fetchAllData(),
    enabled: true,
  });

  useRealtimeSubscription({
    table: 'stores',
    onInsert: () => fetchAllData(),
    onDelete: () => fetchAllData(),
    enabled: true,
  });

  useRealtimeSubscription({
    table: 'departments',
    onInsert: () => fetchAllData(),
    onDelete: () => fetchAllData(),
    enabled: true,
  });

  const fetchAllData = async () => {
    try {
      // Fetch all data in parallel
      const [
        officesRes,
        gatesRes,
        storesRes,
        departmentsRes,
        productsRes,
        gatePassesRes,
        sessionsRes
      ] = await Promise.all([
        supabase.from('offices').select('*').order('created_at', { ascending: false }),
        supabase.from('gates').select('id'),
        supabase.from('stores').select('id'),
        supabase.from('departments').select('id'),
        supabase.from('products').select('id'),
        supabase.from('gate_passes').select('id'),
        supabase.from('login_sessions')
          .select('id, login_at, device_name, browser, user_id')
          .eq('role', 'admin')
          .order('login_at', { ascending: false })
          .limit(10)
      ]);

      const officesData = officesRes.data || [];
      setOffices(officesData);
      
      setStats({
        totalOffices: officesData.length,
        activeOffices: officesData.filter(o => o.status === 'active').length,
        totalGates: gatesRes.data?.length || 0,
        totalStores: storesRes.data?.length || 0,
        totalDepartments: departmentsRes.data?.length || 0,
        totalProducts: productsRes.data?.length || 0,
        totalGatePasses: gatePassesRes.data?.length || 0,
      });

      // Fetch profile names for sessions
      if (sessionsRes.data) {
        const sessionsWithProfiles = await Promise.all(
          sessionsRes.data.map(async (session) => {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('name')
              .eq('user_id', session.user_id)
              .single();
            return { ...session, profiles: profileData };
          })
        );
        setAdminSessions(sessionsWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    { 
      label: 'Total Offices', 
      value: stats.totalOffices, 
      icon: <Building2 className="h-5 w-5" />,
      subtext: `${stats.activeOffices} active`,
      color: 'from-primary to-primary/80'
    },
    { 
      label: 'Total Gates', 
      value: stats.totalGates, 
      icon: <DoorOpen className="h-5 w-5" />,
      subtext: 'Across all offices',
      color: 'from-info to-info/80'
    },
    { 
      label: 'Total Stores', 
      value: stats.totalStores, 
      icon: <Store className="h-5 w-5" />,
      subtext: 'Across all offices',
      color: 'from-success to-success/80'
    },
    { 
      label: 'Total Departments', 
      value: stats.totalDepartments, 
      icon: <Users className="h-5 w-5" />,
      subtext: 'Across all offices',
      color: 'from-warning to-warning/80'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title text-xl sm:text-2xl">Dashboard</h1>
        <p className="page-description text-sm">Welcome back! Here's an overview of your system.</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statsCards.map((stat, index) => (
          <div 
            key={stat.label} 
            className="stat-card animate-slide-up p-3 sm:p-4"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{stat.label}</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{stat.subtext}</p>
              </div>
              <div className={`icon-container bg-gradient-to-br ${stat.color} flex-shrink-0`}>
                <span className="text-primary-foreground">{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="border-border/50 bg-info/5">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10 flex-shrink-0">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-info">{stats.totalProducts}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Gate Entries</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-success/5">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10 flex-shrink-0">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-success">{stats.totalGatePasses}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Gate Passes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Offices */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-semibold">Recent Offices</CardTitle>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {offices.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No offices created yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Create your first office to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {offices.slice(0, 5).map((office) => (
                  <div 
                    key={office.id}
                    className="flex items-center gap-3 p-2 sm:p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="icon-container-secondary !p-2 !rounded-lg flex-shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate text-sm sm:text-base">{office.name}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {office.location || 'No location'}
                      </p>
                    </div>
                    <span className={`text-[10px] sm:text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                      office.status === 'active' ? 'status-active' : 'status-inactive'
                    }`}>
                      {office.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Login History */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-semibold">Admin Login History</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {adminSessions.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No login history yet</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {adminSessions.map((session) => (
                  <div 
                    key={session.id}
                    className="flex items-center gap-3 p-2 sm:p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="icon-container-secondary !p-2 !rounded-lg flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate text-sm sm:text-base">
                        {session.profiles?.name || 'Admin'}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {session.device_name || 'Unknown'} • {session.browser || 'Browser'}
                      </p>
                    </div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(session.login_at), 'dd MMM, hh:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default AdminDashboard;
